import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "./select";

describe("Select", () => {
  it("renders trigger with data-slot", () => {
    render(
      <Select defaultValue="a">
        <SelectTrigger data-testid="trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
        </SelectContent>
      </Select>
    );
    expect(screen.getByTestId("trigger")).toHaveAttribute("data-slot", "select-trigger");
  });

  it("displays selected value text", () => {
    render(
      <Select defaultValue="a">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
        </SelectContent>
      </Select>
    );
    expect(screen.getByText("Option A")).toBeInTheDocument();
  });

  it("applies custom className to trigger", () => {
    render(
      <Select defaultValue="a">
        <SelectTrigger className="my-trigger" data-testid="trig">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>
    );
    expect(screen.getByTestId("trig")).toHaveClass("my-trigger");
  });

  it("renders with sm size", () => {
    render(
      <Select defaultValue="a">
        <SelectTrigger size="sm" data-testid="sm-trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>
    );
    expect(screen.getByTestId("sm-trigger")).toHaveAttribute("data-size", "sm");
  });

  it("renders SelectLabel with data-slot", () => {
    render(
      <Select defaultValue="a" open>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel data-testid="select-label">Fruits</SelectLabel>
            <SelectItem value="a">Apple</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );
    const label = screen.getByTestId("select-label");
    expect(label).toHaveAttribute("data-slot", "select-label");
  });

  it("renders SelectLabel with custom className", () => {
    render(
      <Select defaultValue="a" open>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel className="my-label" data-testid="label">Label</SelectLabel>
            <SelectItem value="a">A</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );
    expect(screen.getByTestId("label")).toHaveClass("my-label");
  });

  it("renders SelectSeparator with data-slot", () => {
    render(
      <Select defaultValue="a" open>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
          <SelectSeparator data-testid="sep" />
          <SelectItem value="b">B</SelectItem>
        </SelectContent>
      </Select>
    );
    const sep = screen.getByTestId("sep");
    expect(sep).toHaveAttribute("data-slot", "select-separator");
  });

  it("renders SelectSeparator with custom className", () => {
    render(
      <Select defaultValue="a" open>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
          <SelectSeparator className="my-sep" data-testid="sep2" />
          <SelectItem value="b">B</SelectItem>
        </SelectContent>
      </Select>
    );
    expect(screen.getByTestId("sep2")).toHaveClass("my-sep");
  });

  it("renders SelectContent with position=popper", () => {
    render(
      <Select defaultValue="a" open>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" data-testid="popper-content">
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>
    );
    const content = screen.getByTestId("popper-content");
    expect(content).toBeInTheDocument();
  });
});
