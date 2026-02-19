import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "./popover";

describe("Popover", () => {
  it("renders trigger", () => {
    render(
      <Popover>
        <PopoverTrigger asChild>
          <button>Open</button>
        </PopoverTrigger>
        <PopoverContent>Popover body</PopoverContent>
      </Popover>
    );
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });

  it("shows content on trigger click", async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger asChild>
          <button>Open</button>
        </PopoverTrigger>
        <PopoverContent>Popover body</PopoverContent>
      </Popover>
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText("Popover body")).toBeInTheDocument();
  });

  it("renders PopoverAnchor with data-slot", () => {
    render(
      <Popover>
        <PopoverAnchor data-testid="anchor">Anchor</PopoverAnchor>
        <PopoverTrigger asChild>
          <button>Open</button>
        </PopoverTrigger>
        <PopoverContent>Body</PopoverContent>
      </Popover>
    );
    expect(screen.getByTestId("anchor")).toHaveAttribute("data-slot", "popover-anchor");
  });

  it("renders PopoverHeader with data-slot", () => {
    render(<PopoverHeader data-testid="hdr">Header</PopoverHeader>);
    expect(screen.getByTestId("hdr")).toHaveAttribute("data-slot", "popover-header");
  });

  it("renders PopoverTitle with data-slot", () => {
    render(<PopoverTitle>Title</PopoverTitle>);
    expect(screen.getByText("Title")).toHaveAttribute("data-slot", "popover-title");
  });

  it("renders PopoverDescription with data-slot", () => {
    render(<PopoverDescription>Desc</PopoverDescription>);
    expect(screen.getByText("Desc")).toHaveAttribute("data-slot", "popover-description");
  });
});
