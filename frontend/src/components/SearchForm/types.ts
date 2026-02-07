import type { FlightSearchParams } from "@/lib/schemas/flightSearch";

export interface SearchFormProps {
  /** Called when the form is submitted with validated data */
  onSubmit: (data: FlightSearchParams) => void | Promise<void>;
  /** Whether the form is in a submitting/loading state */
  isSubmitting?: boolean;
  /** Default values to pre-fill the form */
  defaultValues?: Partial<FlightSearchParams>;
}
