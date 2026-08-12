"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar as CalendarIcon } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { usePillBanner } from "@/components/pill-banner-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TRIP_TYPES, formatTripType } from "@/lib/trips";
import { composeDestination } from "@/lib/trip-destination";
import {
  hasGuestTrip,
  writeGuestCustomItems,
  writeGuestPackingItems,
  writeGuestTrip,
} from "@/lib/guest-storage";
import { cn, fieldClass, glassCard, sectionTitleClass } from "@/lib/utils";
import { createTrip, updateTrip, type CreateTripState } from "./actions";

const CityCombobox = dynamic(() => import("@/components/city-combobox").then((m) => ({ default: m.CityCombobox })), {
  ssr: false,
  loading: () => <Skeleton className="h-10 w-full" />,
});

const CountryCombobox = dynamic(
  () =>
    import("@/components/country-combobox").then((m) => ({
      default: m.CountryCombobox,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-10 w-full" />,
  }
);

const Calendar = dynamic(
  () =>
    import("@/components/ui/calendar").then((m) => ({ default: m.Calendar })),
  {
    ssr: false,
    loading: () => <Skeleton className="mx-auto h-[300px] w-full max-w-sm" />,
  }
);

const initialState: CreateTripState = { error: null };

/** Glass panel wrapping one logical group of fields. */
const sectionClass = "flex flex-col gap-5 p-5 sm:p-6";
const labelClass = "text-sm font-semibold";
/** Inline validation copy, as a soft red panel under its field. */
const errorPanelClass =
  "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2";

export type NewTripFormDefaults = {
  city: string;
  countryCode: string;
  start_date: string;
  end_date: string;
  trip_type: string;
  travelers: number;
};

type NewTripFormProps = {
  mode?: "create" | "edit";
  tripId?: string;
  defaultValues?: Partial<NewTripFormDefaults>;
  /** When set, submit builds a local guest trip instead of calling the server. */
  guestMode?: boolean;
};

/** Parse a stored `YYYY-MM-DD` string as a local (not UTC) calendar date. */
function parseISODate(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Format a local Date back to `YYYY-MM-DD` without timezone drift. */
function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** SSR-safe media query hook. Defaults to `false` until mounted on the client. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

function formatRangeLabel(range: DateRange | undefined): string {
  if (!range?.from) return "Select dates";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const fromLabel = range.from.toLocaleDateString(undefined, opts);
  if (!range.to) return fromLabel;
  const toLabel = range.to.toLocaleDateString(undefined, opts);
  return `${fromLabel} – ${toLabel}`;
}

/** Inclusive day count + labels for the date-sheet preview (e.g. "Aug 12 — Aug 20 (8 days)"). */
function formatRangePreview(range: DateRange | undefined): string | null {
  if (!range?.from || !range?.to) return null;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const fromLabel = range.from.toLocaleDateString(undefined, opts);
  const toLabel = range.to.toLocaleDateString(undefined, opts);
  const fromDay = new Date(range.from);
  fromDay.setHours(0, 0, 0, 0);
  const toDay = new Date(range.to);
  toDay.setHours(0, 0, 0, 0);
  const days = Math.round((toDay.getTime() - fromDay.getTime()) / 86_400_000) + 1;
  if (!Number.isFinite(days) || days < 1) return null;
  return `${fromLabel} — ${toLabel} (${days} ${days === 1 ? "day" : "days"})`;
}

const newTripSchema = z
  .object({
    city: z
      .string()
      .trim()
      .min(1, "City is required.")
      .min(2, "City must be at least 2 characters.")
      .refine((value) => !/\d/.test(value), {
        message: "City cannot contain numbers.",
      }),
    countryCode: z.string(),
    start_date: z.string().min(1, "Start date is required."),
    end_date: z.string().min(1, "End date is required."),
    trip_type: z.string().min(1, "Please select a trip type."),
    travelers: z
      .number({ error: "At least 1 traveler." })
      .int()
      .min(1, "At least 1 traveler."),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: "End date must be on or after the start date.",
    path: ["end_date"],
  });

type NewTripValues = z.infer<typeof newTripSchema>;

export function NewTripForm({
  mode = "create",
  tripId,
  defaultValues,
  guestMode = false,
}: NewTripFormProps) {
  const isEdit = !guestMode && mode === "edit" && Boolean(tripId);
  const router = useRouter();
  const [state, formAction] = useFormState(
    isEdit ? updateTrip : createTrip,
    initialState
  );
  const [isPending, startTransition] = useTransition();
  const [guestBusy, setGuestBusy] = useState(false);
  const [guestReplacePrompt, setGuestReplacePrompt] = useState(false);
  const { showBanner } = usePillBanner();

  useEffect(() => {
    if (state.error) {
      showBanner({ message: state.error, variant: "error" });
    }
  }, [state.error, showBanner]);

  const form = useForm<NewTripValues>({
    resolver: zodResolver(newTripSchema),
    defaultValues: {
      city: defaultValues?.city ?? "",
      countryCode: defaultValues?.countryCode ?? "",
      start_date: defaultValues?.start_date ?? "",
      end_date: defaultValues?.end_date ?? "",
      trip_type: defaultValues?.trip_type ?? "",
      travelers: defaultValues?.travelers ?? 1,
    },
  });

  const tripType = form.watch("trip_type");
  const city = form.watch("city");
  const countryCode = form.watch("countryCode");
  const startDate = form.watch("start_date");
  const endDate = form.watch("end_date");
  const [dateOpen, setDateOpen] = useState(false);

  const requiredFieldsComplete = Boolean(
    city.trim().length >= 2 &&
      !/\d/.test(city) &&
      startDate &&
      endDate &&
      endDate >= startDate &&
      tripType
  );

  // Local, uncommitted selection edited inside the sheet. Only copied into the
  // form values when the user confirms with "Done"; discarded on cancel/esc.
  const [tempRange, setTempRange] = useState<DateRange | undefined>(undefined);

  // 2 months on desktop, 1 on mobile so the calendar never overflows.
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const numberOfMonths = isDesktop ? 2 : 1;

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const selectedRange: DateRange | undefined = startDate
    ? { from: parseISODate(startDate), to: parseISODate(endDate) }
    : undefined;

  const tempRangeComplete = Boolean(tempRange?.from && tempRange?.to);

  function handleDateOpenChange(open: boolean) {
    if (open) {
      // Seed the temp selection from the committed values so reopening shows
      // the existing range.
      setTempRange(selectedRange);
    } else {
      // Closing via outside-click or esc behaves like Cancel: drop the temp
      // selection, leaving the committed form values untouched.
      setTempRange(undefined);
    }
    setDateOpen(open);
  }

  function handleCancelDates() {
    setTempRange(undefined);
    setDateOpen(false);
  }

  function handleDoneDates() {
    const from = tempRange?.from;
    const to = tempRange?.to;
    // Secondary guard: Done is disabled until both are picked.
    if (!from || !to) return;
    form.setValue("start_date", toISODate(from), {
      shouldValidate: true,
      shouldDirty: true,
    });
    form.setValue("end_date", toISODate(to), {
      shouldValidate: true,
      shouldDirty: true,
    });
    setTempRange(undefined);
    setDateOpen(false);
  }

  async function saveGuestTrip(values: NewTripValues, replaceExisting: boolean) {
    if (!replaceExisting && hasGuestTrip()) {
      setGuestReplacePrompt(true);
      return;
    }

    setGuestBusy(true);
    setGuestReplacePrompt(false);
    try {
      const destination = composeDestination(
        values.city.trim(),
        values.countryCode.trim().toUpperCase()
      );
      if (!destination) {
        showBanner({ message: "Destination is required.", variant: "error" });
        return;
      }

      if (replaceExisting) {
        writeGuestPackingItems([]);
        writeGuestCustomItems([]);
      }

      writeGuestTrip({
        destination,
        startDate: values.start_date,
        endDate: values.end_date,
        tripType: values.trip_type,
        travelers: values.travelers,
      });

      showBanner({
        message: replaceExisting
          ? "Demo trip replaced — stored in this browser only."
          : "Guest trip created — stored in this browser only.",
        variant: "success",
      });
      router.push("/dashboard/guest");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not create guest trip.";
      showBanner({ message, variant: "error" });
    } finally {
      setGuestBusy(false);
    }
  }

  async function onGuestValid(values: NewTripValues) {
    await saveGuestTrip(values, false);
  }

  function onValid(values: NewTripValues) {
    if (guestMode) {
      void onGuestValid(values);
      return;
    }
    const formData = new FormData();
    if (isEdit && tripId) {
      formData.set("tripId", tripId);
    }
    formData.set("city", values.city.trim());
    formData.set("countryCode", values.countryCode.trim().toUpperCase());
    formData.set("start_date", values.start_date);
    formData.set("end_date", values.end_date);
    formData.set("trip_type", values.trip_type);
    formData.set("travelers", String(values.travelers));
    startTransition(() => {
      formAction(formData);
    });
  }

  const busy = isPending || guestBusy;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onValid)}
        className="mx-auto flex w-full max-w-2xl flex-col gap-5 sm:gap-6"
        data-testid={isEdit ? "edit-trip-form" : "new-trip-form"}
      >
        <section className={cn(glassCard, sectionClass)}>
          <h2 className={sectionTitleClass}>Destination</h2>

          <FormField
            control={form.control}
            name="countryCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClass}>
                  Country{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </FormLabel>
                <FormControl>
                  <CountryCombobox
                    className="w-full"
                    value={field.value}
                    onChange={(code) => {
                      field.onChange(code);
                      form.setValue("city", "");
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Optional — narrows city suggestions. You can leave this blank
                  and search cities worldwide.
                </FormDescription>
                <FormMessage className={errorPanelClass} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClass}>City</FormLabel>
                <FormControl>
                  <CityCombobox
                    className="w-full"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    countryCode={countryCode}
                  />
                </FormControl>
                <FormDescription>
                  {countryCode.trim()
                    ? "Search cities in the selected country, or type a custom city."
                    : "Search cities worldwide — country is optional."}
                </FormDescription>
                <FormMessage
                  className={errorPanelClass}
                  data-testid="city-error"
                />
              </FormItem>
            )}
          />
        </section>

        <section className={cn(glassCard, sectionClass)}>
          <h2 className={sectionTitleClass}>Dates</h2>

          <FormField
            control={form.control}
            name="start_date"
            render={() => (
              <FormItem className="flex flex-col">
                <FormLabel className={labelClass}>Trip dates</FormLabel>
                <Sheet open={dateOpen} onOpenChange={handleDateOpenChange}>
                  <SheetTrigger asChild>
                    <FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        data-testid="date-range-trigger"
                        className={cn(
                          fieldClass,
                          "h-12 justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon
                          className="h-4 w-4 shrink-0 opacity-60"
                          aria-hidden
                        />
                        <span className="truncate">
                          {formatRangeLabel(selectedRange)}
                        </span>
                      </Button>
                    </FormControl>
                  </SheetTrigger>
                  <SheetContent
                    side="bottom"
                    className="flex max-h-[90vh] flex-col gap-0 p-0"
                  >
                    <SheetHeader className="border-b border-border/60 px-5 py-4 pr-14 text-left">
                      <SheetTitle>Select Trip Dates</SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                      <div className="flex justify-center">
                        <Calendar
                          mode="range"
                          selected={tempRange}
                          onSelect={setTempRange}
                          defaultMonth={tempRange?.from ?? today}
                          numberOfMonths={numberOfMonths}
                          disabled={isEdit ? undefined : { before: today }}
                          autoFocus
                        />
                      </div>
                      {!tempRangeComplete && (
                        <p
                          className="mt-4 text-center text-sm text-muted-foreground"
                          data-testid="date-range-hint"
                        >
                          Tap start date, then end date
                        </p>
                      )}
                    </div>
                    <SheetFooter className="flex-col gap-3 border-t border-border/60 px-5 py-4 sm:space-x-0">
                      {tempRangeComplete ? (
                        <p
                          className="w-full text-center text-sm font-medium sm:text-left"
                          data-testid="date-range-preview"
                        >
                          {formatRangePreview(tempRange)}
                        </p>
                      ) : null}
                      <div className="flex w-full flex-row justify-end gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCancelDates}
                          data-testid="date-range-cancel"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={handleDoneDates}
                          disabled={!tempRangeComplete}
                          data-testid="date-range-done"
                        >
                          Done
                        </Button>
                      </div>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
                <FormMessage className={errorPanelClass} />
                {!form.formState.errors.start_date &&
                  form.formState.errors.end_date && (
                    <p
                      className={cn(
                        errorPanelClass,
                        "text-[0.8rem] font-medium text-destructive"
                      )}
                    >
                      {String(form.formState.errors.end_date.message ?? "")}
                    </p>
                  )}
              </FormItem>
            )}
          />
        </section>

        <section className={cn(glassCard, sectionClass)}>
          <h2 className={sectionTitleClass}>Trip details</h2>

          <FormField
            control={form.control}
            name="trip_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClass}>Trip type</FormLabel>
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger data-testid="trip-type-select">
                      <SelectValue placeholder="Select a trip type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TRIP_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {formatTripType(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage className={errorPanelClass} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="travelers"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClass}>
                  Number of travelers
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    data-testid="travelers-input"
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value === ""
                          ? ""
                          : Number.parseInt(event.target.value, 10)
                      )
                    }
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage className={errorPanelClass} />
              </FormItem>
            )}
          />
        </section>

        {guestMode && guestReplacePrompt ? (
          <div
            role="status"
            className="flex flex-col gap-3 rounded-xl border border-brand-from/25 bg-brand-from/10 px-4 py-3 text-sm"
            data-testid="guest-replace-prompt"
          >
            <p className="text-foreground">
              Guest mode keeps one demo trip in this browser. Replace it with
              this new one, or create a free account for multiple trips.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                data-testid="guest-replace-demo"
                onClick={() => {
                  void form.handleSubmit((values) =>
                    saveGuestTrip(values, true)
                  )();
                }}
              >
                Replace my demo trip
              </Button>
              <Button asChild type="button" size="sm" variant="outline">
                <Link href="/signup?from=guest">Sign up free</Link>
              </Button>
            </div>
          </div>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={busy || !requiredFieldsComplete}
          data-testid={isEdit ? "edit-trip-submit" : "create-trip-submit"}
        >
          {busy
            ? guestMode
              ? "Saving trip…"
              : isEdit
                ? "Saving…"
                : "Creating trip…"
            : guestMode
              ? "Create guest trip"
              : isEdit
                ? "Save changes"
                : "Create trip"}
        </Button>
        {!requiredFieldsComplete && !busy ? (
          <p
            className="text-center text-sm text-muted-foreground"
            data-testid="submit-incomplete-hint"
          >
            Add a city, trip dates, and trip type to continue.
          </p>
        ) : null}
      </form>
    </Form>
  );
}
