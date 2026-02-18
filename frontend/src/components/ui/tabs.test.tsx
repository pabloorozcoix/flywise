import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

describe("Tabs", () => {
  const renderTabs = () =>
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
          <TabsTrigger value="b">Tab B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Content A</TabsContent>
        <TabsContent value="b">Content B</TabsContent>
      </Tabs>
    );

  it("renders tab triggers", () => {
    renderTabs();
    expect(screen.getByRole("tab", { name: "Tab A" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tab B" })).toBeInTheDocument();
  });

  it("shows first tab content by default", () => {
    renderTabs();
    expect(screen.getByText("Content A")).toBeInTheDocument();
  });

  it("switches content on tab click", async () => {
    const user = userEvent.setup();
    renderTabs();
    await user.click(screen.getByRole("tab", { name: "Tab B" }));
    expect(screen.getByText("Content B")).toBeInTheDocument();
  });

  it("has correct data-slot on tabs-list", () => {
    renderTabs();
    expect(screen.getByRole("tablist")).toHaveAttribute("data-slot", "tabs-list");
  });

  it("marks active trigger with data-state=active", () => {
    renderTabs();
    expect(screen.getByRole("tab", { name: "Tab A" })).toHaveAttribute("data-state", "active");
    expect(screen.getByRole("tab", { name: "Tab B" })).toHaveAttribute("data-state", "inactive");
  });
});
