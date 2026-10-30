import { fireEvent, render, screen } from "@testing-library/react";
import { Camera, FileText, LinkIcon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { WatchBottomNav, type WatchNavItem } from "./WatchBottomNav";

describe("WatchBottomNav", () => {
  const items: WatchNavItem<string>[] = [
    { id: "cam", label: "Câmera", icon: Camera },
    { id: "link", label: "Link", icon: LinkIcon },
    { id: "text", label: "Texto", icon: FileText },
  ];

  it("renderiza todos os itens lado a lado com ícones e rótulos", () => {
    render(
      <WatchBottomNav
        items={items}
        activeId="cam"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("tab", { name: /Câmera/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Link/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Texto/i })).toBeInTheDocument();
  });

  it("destaca claramente a opção selecionada com aria-selected e classe active", () => {
    render(
      <WatchBottomNav
        items={items}
        activeId="link"
        onChange={vi.fn()}
        accentColor="blue"
      />
    );

    const activeTab = screen.getByRole("tab", { name: /Link/i });
    const inactiveTab = screen.getByRole("tab", { name: /Câmera/i });

    expect(activeTab).toHaveAttribute("aria-selected", "true");
    expect(activeTab.className).toContain("active");
    expect(activeTab.className).toContain("accent-blue");
    expect(inactiveTab).toHaveAttribute("aria-selected", "false");
    expect(inactiveTab.className).not.toContain("active");
  });

  it("chama onChange ao clicar em um item", () => {
    const onChange = vi.fn();
    render(
      <WatchBottomNav
        items={items}
        activeId="cam"
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: /Texto/i }));
    expect(onChange).toHaveBeenCalledWith("text");
  });

  it("desabilita botões quando disabled=true", () => {
    render(
      <WatchBottomNav
        items={items}
        activeId="cam"
        onChange={vi.fn()}
        disabled={true}
      />
    );

    const tabs = screen.getAllByRole("tab");
    tabs.forEach((tab) => {
      expect(tab).toBeDisabled();
    });
  });
});
