import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogMedia,
} from "./alert-dialog";

describe("AlertDialog", () => {
  it("renders AlertDialogMedia with correct data-slot", () => {
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia data-testid="media">
              <span>Icon</span>
            </AlertDialogMedia>
            <AlertDialogTitle>Title</AlertDialogTitle>
            <AlertDialogDescription>Description</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );

    const media = screen.getByTestId("media");
    expect(media).toBeInTheDocument();
    expect(media).toHaveAttribute("data-slot", "alert-dialog-media");
    expect(screen.getByText("Icon")).toBeInTheDocument();
  });

  it("renders AlertDialogMedia with custom className", () => {
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="custom-class" data-testid="media-custom" />
            <AlertDialogTitle>Title</AlertDialogTitle>
            <AlertDialogDescription>Desc</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );

    const media = screen.getByTestId("media-custom");
    expect(media.className).toContain("custom-class");
  });
});
