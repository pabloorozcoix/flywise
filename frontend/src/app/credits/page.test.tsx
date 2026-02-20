import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CreditsPage from "./page";

describe("Credits page", () => {
  it("renders the Credits heading", () => {
    render(<CreditsPage />);
    expect(screen.getByText("Credits")).toBeInTheDocument();
  });

  it("renders the subtitle", () => {
    render(<CreditsPage />);
    expect(
      screen.getByText("Learn how to use FlyWise, what powers it, and who built it")
    ).toBeInTheDocument();
  });

  // Section 1: How to Use
  it("renders the How to Use section", () => {
    render(<CreditsPage />);
    expect(screen.getByText("How to Use FlyWise")).toBeInTheDocument();
  });

  it("renders feature cards for app usage", () => {
    render(<CreditsPage />);
    expect(screen.getByText("Flight Search")).toBeInTheDocument();
    expect(screen.getByText("Execution Timeline")).toBeInTheDocument();
    expect(screen.getByText("History & Results")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  // Section 2: About the Project
  it("renders the About the Project section", () => {
    render(<CreditsPage />);
    expect(screen.getByText("About the Project")).toBeInTheDocument();
  });

  it("renders project feature cards", () => {
    render(<CreditsPage />);
    expect(screen.getByText("The Stack & Containers")).toBeInTheDocument();
    expect(screen.getByText("Testing")).toBeInTheDocument();
    expect(screen.getByText("Local, Private Small Language Model")).toBeInTheDocument();
    expect(screen.getByText("Extensibility")).toBeInTheDocument();
  });

  // Section 3: Authors
  it("renders the Authors section", () => {
    render(<CreditsPage />);
    expect(screen.getByText("Authors")).toBeInTheDocument();
  });

  it("renders all team members", () => {
    render(<CreditsPage />);
    expect(screen.getByText("Ale Alfaro")).toBeInTheDocument();
    expect(screen.getByText("Product Owner")).toBeInTheDocument();

    expect(screen.getByText("Luis Martinez")).toBeInTheDocument();
    expect(screen.getByText("UI/UX Designer")).toBeInTheDocument();

    expect(screen.getByText("Kevin Martinez")).toBeInTheDocument();
    // Two "Software Engineer" roles exist, so use getAllByText
    expect(screen.getAllByText("Software Engineer")).toHaveLength(2);

    expect(screen.getByText("Jesús Sánchez")).toBeInTheDocument();

    expect(screen.getByText("Pablo Orozco")).toBeInTheDocument();
    expect(screen.getByText("Tech Lead / Software Engineer")).toBeInTheDocument();
  });
});
