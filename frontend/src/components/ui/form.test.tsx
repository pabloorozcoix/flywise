import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "./form";
import { Input } from "./input";

function TestForm() {
  const form = useForm({
    defaultValues: { name: "" },
  });
  return (
    <Form {...form}>
      <form>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Your name" {...field} />
              </FormControl>
              <FormDescription>Enter your full name</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

const schema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
});

function TestFormWithValidation() {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => {})}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Your name" {...field} />
              </FormControl>
              <FormDescription>Enter your full name</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit">Submit</button>
      </form>
    </Form>
  );
}

function TestFormMessageWithChildren() {
  const form = useForm({
    defaultValues: { name: "" },
  });
  return (
    <Form {...form}>
      <form>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Your name" {...field} />
              </FormControl>
              <FormMessage>Custom message</FormMessage>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

describe("Form primitives", () => {
  it("renders label with data-slot", () => {
    render(<TestForm />);
    expect(screen.getByText("Name")).toHaveAttribute("data-slot", "form-label");
  });

  it("renders input inside FormControl", () => {
    render(<TestForm />);
    expect(screen.getByPlaceholderText("Your name")).toBeInTheDocument();
  });

  it("renders description with data-slot", () => {
    render(<TestForm />);
    const desc = screen.getByText("Enter your full name");
    expect(desc).toHaveAttribute("data-slot", "form-description");
  });

  it("renders form-item container", () => {
    render(<TestForm />);
    const items = document.querySelectorAll("[data-slot='form-item']");
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it("renders FormMessage with error when validation fails", async () => {
    const user = userEvent.setup();
    render(<TestFormWithValidation />);

    // Submit without filling the required field
    await user.click(screen.getByText("Submit"));

    await waitFor(() => {
      const errorMessage = screen.getByText("Name must be at least 3 characters");
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveAttribute("data-slot", "form-message");
    });
  });

  it("renders FormMessage with children when no error", () => {
    render(<TestFormMessageWithChildren />);
    const msg = screen.getByText("Custom message");
    expect(msg).toBeInTheDocument();
    expect(msg).toHaveAttribute("data-slot", "form-message");
  });

  it("FormLabel has error styling when field has error", async () => {
    const user = userEvent.setup();
    render(<TestFormWithValidation />);

    await user.click(screen.getByText("Submit"));

    await waitFor(() => {
      const label = screen.getByText("Name");
      expect(label).toHaveAttribute("data-error", "true");
    });
  });

  it("FormControl sets aria-invalid when there is an error", async () => {
    const user = userEvent.setup();
    render(<TestFormWithValidation />);

    await user.click(screen.getByText("Submit"));

    await waitFor(() => {
      const input = screen.getByPlaceholderText("Your name");
      expect(input).toHaveAttribute("aria-invalid", "true");
    });
  });
});
