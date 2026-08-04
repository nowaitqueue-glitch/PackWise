"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { citiesByCountry } from "@/lib/cities";
import { cn, fieldClass } from "@/lib/utils";

type CityOption = {
  value: string;
  label: string;
  /** City name committed to the form (without country suffix). */
  cityName: string;
};

type CityComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  countryCode: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  onBlur?: () => void;
};

function getCityOptions(countryCode: string): CityOption[] {
  const code = countryCode.trim().toUpperCase();
  if (code) {
    return (citiesByCountry[code] || []).map((name) => ({
      value: name,
      label: name,
      cityName: name,
    }));
  }

  // Global search when country is optional / empty.
  const options: CityOption[] = [];
  for (const [country, cities] of Object.entries(citiesByCountry)) {
    for (const name of cities) {
      options.push({
        value: `${name}__${country}`,
        label: `${name} (${country})`,
        cityName: name,
      });
    }
  }
  return options;
}

function filterCityOptions(options: CityOption[], query: string): CityOption[] {
  const trimmed = query.trim();
  if (!trimmed) return options;
  const lower = trimmed.toLowerCase();
  return options.filter(
    (option) =>
      option.label.toLowerCase().includes(lower) ||
      option.cityName.toLowerCase().includes(lower)
  );
}

const GLOBAL_RESULT_LIMIT = 80;

export const CityCombobox = forwardRef<HTMLButtonElement, CityComboboxProps>(
  function CityCombobox(
    {
      value,
      onChange,
      countryCode,
      disabled,
      id,
      className,
      onBlur,
      ...props
    },
    ref
  ) {
    const listId = useId();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value);

    const hasCountry = Boolean(countryCode.trim());
    const countryHasCities = hasCountry
      ? Boolean(citiesByCountry[countryCode.trim().toUpperCase()])
      : true;

    const allOptions = useMemo(
      () => getCityOptions(countryCode),
      [countryCode]
    );

    const filteredOptions = useMemo(() => {
      const filtered = filterCityOptions(allOptions, search);
      // Cap global results so the list stays responsive.
      if (!hasCountry && filtered.length > GLOBAL_RESULT_LIMIT) {
        return filtered.slice(0, GLOBAL_RESULT_LIMIT);
      }
      return filtered;
    }, [allOptions, search, hasCountry]);

    useEffect(() => {
      if (!open) {
        setSearch(value);
      }
    }, [value, open]);

    function commitSearchAsValue(next: string) {
      const trimmed = next.trim();
      if (trimmed !== value) {
        onChange(trimmed);
      }
    }

    function handleOpenChange(nextOpen: boolean) {
      if (disabled && nextOpen) return;
      if (!nextOpen) {
        commitSearchAsValue(search);
        onBlur?.();
      } else {
        setSearch(value);
      }
      setOpen(nextOpen);
    }

    function handleSearchChange(next: string) {
      setSearch(next);
      onChange(next);
    }

    function selectCity(cityName: string) {
      setSearch(cityName);
      onChange(cityName);
      setOpen(false);
      onBlur?.();
    }

    const trimmedSearch = search.trim();
    const hasTyped = trimmedSearch.length > 0;
    const exactMatch = filteredOptions.some(
      (option) =>
        option.cityName.toLowerCase() === trimmedSearch.toLowerCase() ||
        option.label.toLowerCase() === trimmedSearch.toLowerCase()
    );
    const showCreateOption = hasTyped && !exactMatch;
    const showStartTyping = !hasTyped;
    const showNoCities =
      hasTyped &&
      filteredOptions.length === 0 &&
      (hasCountry ? countryHasCities : true);

    return (
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label="City"
            disabled={disabled}
            data-testid="city-combobox"
            className={cn(
              fieldClass,
              "h-12 justify-between font-normal",
              !value && "text-muted-foreground",
              className
            )}
            {...props}
          >
            <span className="truncate">{value || "Search city…"}</span>
            <ChevronsUpDown
              className="h-4 w-4 shrink-0 opacity-50"
              aria-hidden
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={
                hasCountry ? "Search city…" : "Search cities worldwide…"
              }
              value={search}
              onValueChange={handleSearchChange}
              data-testid="city-combobox-search"
            />
            <CommandList id={listId}>
              <CommandEmpty>
                {showStartTyping
                  ? "Start typing to search"
                  : showNoCities
                    ? "No cities found"
                    : null}
              </CommandEmpty>
              {(filteredOptions.length > 0 ||
                showCreateOption ||
                showNoCities ||
                showStartTyping) && (
                <CommandGroup>
                  {showStartTyping ? (
                    <div
                      className="px-3 py-2.5 text-sm text-muted-foreground"
                      data-testid="city-combobox-start-typing"
                    >
                      {hasCountry
                        ? "Start typing to search"
                        : "Start typing to search cities worldwide"}
                    </div>
                  ) : null}
                  {showNoCities ? (
                    <div
                      className="px-3 py-2.5 text-sm text-muted-foreground"
                      data-testid="city-combobox-empty"
                    >
                      No cities found
                    </div>
                  ) : null}
                  {showCreateOption ? (
                    <CommandItem
                      value={`use-${trimmedSearch}`}
                      data-testid="city-option-custom"
                      className="px-3 py-2.5"
                      onSelect={() => {
                        commitSearchAsValue(trimmedSearch);
                        setOpen(false);
                        onBlur?.();
                      }}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 text-brand-from",
                          value.trim().toLowerCase() ===
                            trimmedSearch.toLowerCase()
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                        aria-hidden
                      />
                      <span className="truncate">Use “{trimmedSearch}”</span>
                    </CommandItem>
                  ) : null}
                  {filteredOptions.map((option) => {
                    const selected =
                      value.trim().toLowerCase() ===
                      option.cityName.toLowerCase();
                    return (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        data-testid={`city-option-${option.cityName}`}
                        className={cn(
                          "px-3 py-2.5",
                          selected && "bg-brand-from/10 font-semibold"
                        )}
                        onSelect={() => selectCity(option.cityName)}
                      >
                        <Check
                          className={cn(
                            "h-4 w-4 text-brand-from",
                            selected ? "opacity-100" : "opacity-0"
                          )}
                          aria-hidden
                        />
                        <span className="truncate">{option.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }
);
