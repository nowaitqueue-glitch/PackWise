"use client";

import { forwardRef, useState } from "react";
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
import { cn } from "@/lib/utils";
import {
  OTHER_COUNTRIES,
  POPULAR_COUNTRIES,
  getCountryName,
} from "@/lib/countries";

type CountryComboboxProps = {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
};

export const CountryCombobox = forwardRef<
  HTMLButtonElement,
  CountryComboboxProps
>(function CountryCombobox(
  { value, onChange, disabled, id, className, ...props },
  ref
) {
  const [open, setOpen] = useState(false);
  const selectedLabel = value
    ? `${getCountryName(value) ?? value} (${value})`
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Country"
          disabled={disabled}
          data-testid="country-combobox"
          className={cn(
            "w-full justify-between font-normal",
            !selectedLabel && "text-muted-foreground",
            className
          )}
          {...props}
        >
          <span className="truncate">
            {selectedLabel ?? "Select country…"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput
            placeholder="Search country…"
            data-testid="country-combobox-search"
          />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup heading="Popular">
              {POPULAR_COUNTRIES.map((country) => (
                <CommandItem
                  key={country.code}
                  value={`${country.name} ${country.code}`}
                  data-testid={`country-option-${country.code}`}
                  onSelect={() => {
                    onChange(country.code === value ? "" : country.code);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === country.code ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{country.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {country.code}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="All countries">
              {OTHER_COUNTRIES.map((country) => (
                <CommandItem
                  key={country.code}
                  value={`${country.name} ${country.code}`}
                  data-testid={`country-option-${country.code}`}
                  onSelect={() => {
                    onChange(country.code === value ? "" : country.code);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === country.code ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{country.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {country.code}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});
