import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "./card";

describe("Card primitives", () => {
  it("renders Card with data-slot", () => {
    render(<Card data-testid="card">Content</Card>);
    const el = screen.getByTestId("card");
    expect(el).toHaveAttribute("data-slot", "card");
  });

  it("renders CardHeader with data-slot", () => {
    render(<CardHeader data-testid="header">Header</CardHeader>);
    expect(screen.getByTestId("header")).toHaveAttribute("data-slot", "card-header");
  });

  it("renders CardTitle with data-slot", () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByText("Title")).toHaveAttribute("data-slot", "card-title");
  });

  it("renders CardDescription with data-slot", () => {
    render(<CardDescription>Desc</CardDescription>);
    expect(screen.getByText("Desc")).toHaveAttribute("data-slot", "card-description");
  });

  it("renders CardAction with data-slot", () => {
    render(<CardAction data-testid="action">Act</CardAction>);
    expect(screen.getByTestId("action")).toHaveAttribute("data-slot", "card-action");
  });

  it("renders CardContent with data-slot", () => {
    render(<CardContent data-testid="content">Body</CardContent>);
    expect(screen.getByTestId("content")).toHaveAttribute("data-slot", "card-content");
  });

  it("renders CardFooter with data-slot", () => {
    render(<CardFooter data-testid="footer">Foot</CardFooter>);
    expect(screen.getByTestId("footer")).toHaveAttribute("data-slot", "card-footer");
  });

  it("applies custom className to Card", () => {
    render(<Card className="my-card" data-testid="card">C</Card>);
    expect(screen.getByTestId("card")).toHaveClass("my-card");
  });
});
