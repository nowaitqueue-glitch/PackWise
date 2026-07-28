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
import { cn } from "@/lib/utils";

type CityOption = {
  value: string;
  label: string;
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
  if (!code) return [];
  return (citiesByCountry[code] || []).map((name) => ({
    value: name,
    label: name,
  }));
}

function filterCityOptions(options: CityOption[], query: string): CityOption[] {
  const trimmed = query.trim();
  if (!trimmed) return options;
  const lower = trimmed.toLowerCase();
  return options.filter((option) =>
    option.label.toLowerCase().includes(lower)
  );
}

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
    const isDisabled = disabled || !hasCountry;
    const countryHasCities = hasCountry
      ? Boolean(citiesByCountry[countryCode.trim().toUpperCase()])
      : false;

    const allOptions = useMemo(
      () => getCityOptions(countryCode),
      [countryCode]
    );

    const filteredOptions = useMemo(
      () => filterCityOptions(allOptions, search),
      [allOptions, search]
    );

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
      if (isDisabled && nextOpen) return;
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
      (option) => option.label.toLowerCase() === trimmedSearch.toLowerCase()
    );
    const showCreateOption = hasTyped && !exactMatch;
    const showStartTyping =
      hasCountry && !countryHasCities && !hasTyped;
    const showNoCities =
      hasCountry && countryHasCities && hasTyped && filteredOptions.length === 0;

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
            disabled={isDisabled}
            data-testid="city-combobox"
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground",
              className
            )}
            {...props}
          >
            <span className="truncate">
              {value ||
                (hasCountry ? "Search city…" : "Select a country first")}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search city…"
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
                      className="px-2 py-1.5 text-sm text-muted-foreground"
                      data-testid="city-combobox-start-typing"
                    >
                      Start typing to search
                    </div>
                  ) : null}
                  {showNoCities ? (
                    <div
                      className="px-2 py-1.5 text-sm text-muted-foreground"
                      data-testid="city-combobox-empty"
                    >
                      No cities found
                    </div>
                  ) : null}
                  {showCreateOption ? (
                    <CommandItem
                      value={`use-${trimmedSearch}`}
                      data-testid="city-option-custom"
                      onSelect={() => {
                        commitSearchAsValue(trimmedSearch);
                        setOpen(false);
                        onBlur?.();
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value.trim().toLowerCase() ===
                            trimmedSearch.toLowerCase()
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <span className="truncate">Use “{trimmedSearch}”</span>
                    </CommandItem>
                  ) : null}
                  {filteredOptions.map((option) => {
                    const selected =
                      value.trim().toLowerCase() ===
                      option.label.toLowerCase();
                    return (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        data-testid={`city-option-${option.label}`}
                        onSelect={() => selectCity(option.label)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selected ? "opacity-100" : "opacity-0"
                          )}
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
