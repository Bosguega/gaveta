import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

function getOverlay(): HTMLElement {
    // Classe (não role): o diálogo fica display:none quando minimizado e, nesse
    // estado, getByRole o exclui da árvore de acessibilidade.
    return document.querySelector(".duplicate-modal-overlay") as HTMLElement;
}

describe("Modal (base compartilhada)", () => {
    it("renderiza via portal em document.body com role=dialog e aria-modal", () => {
        render(
            <Modal open onClose={vi.fn()} title="Título teste">
                <p>Conteúdo</p>
            </Modal>,
        );

        const dialog = screen.getByRole("dialog");
        expect(dialog.getAttribute("aria-modal")).toBe("true");
        expect(screen.getByRole("heading", { name: "Título teste" })).toBeInTheDocument();
        // Portal: o overlay é filho direto de document.body, fora do container do RTL.
        expect(dialog.parentElement?.parentElement).toBe(document.body);
    });

    it("não fecha ao clicar no backdrop", () => {
        const onClose = vi.fn();
        render(
            <Modal open onClose={onClose} title="Seguro">
                <p>Conteúdo</p>
            </Modal>,
        );

        fireEvent.click(getOverlay());
        expect(onClose).not.toHaveBeenCalled();
    });

    it("fecha pelo botão X; noClose o esconde; busy o desabilita", () => {
        const onClose = vi.fn();
        const { rerender } = render(
            <Modal open onClose={onClose} title="T">
                <p>Conteúdo</p>
            </Modal>,
        );

        fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
        expect(onClose).toHaveBeenCalledTimes(1);

        rerender(
            <Modal open onClose={onClose} title="T" noClose>
                <p>Conteúdo</p>
            </Modal>,
        );
        expect(screen.queryByRole("button", { name: "Fechar" })).not.toBeInTheDocument();

        rerender(
            <Modal open onClose={onClose} title="T" busy>
                <p>Conteúdo</p>
            </Modal>,
        );
        expect(screen.getByRole("button", { name: "Fechar" })).toBeDisabled();
    });

    it("Escape fecha quando permitido e é ignorado quando closeOnEscape=false ou busy", () => {
        const onClose = vi.fn();
        const { rerender } = render(
            <Modal open onClose={onClose} title="T">
                <p>Conteúdo</p>
            </Modal>,
        );

        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);

        rerender(
            <Modal open onClose={onClose} title="T" closeOnEscape={false}>
                <p>Conteúdo</p>
            </Modal>,
        );
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);

        rerender(
            <Modal open onClose={onClose} title="T" busy>
                <p>Conteúdo</p>
            </Modal>,
        );
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("leva o foco para o diálogo ao abrir e devolve ao gatilho ao fechar", async () => {
        function Host() {
            const [open, setOpen] = useState(false);
            return (
                <>
                    <button onClick={() => setOpen(true)}>abrir-host</button>
                    <button onClick={() => setOpen(false)}>fechar-host</button>
                    <Modal open={open} onClose={() => setOpen(false)} title="Foco">
                        <button>conteudo</button>
                    </Modal>
                </>
            );
        }

        render(<Host />);

        const trigger = screen.getByRole("button", { name: "abrir-host" });
        trigger.focus();
        fireEvent.click(trigger);

        await waitFor(() => {
            const dialog = screen.getByRole("dialog");
            expect(dialog.contains(document.activeElement)).toBe(true);
        });

        fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

        await waitFor(() => {
            expect(document.activeElement).toBe(trigger);
        });
    });


    it("prende o foco dentro do diálogo (Tab cicla)", () => {
        // noClose remove o X do header para o trap cobrir apenas o conteúdo.
        render(
            <Modal open onClose={vi.fn()} title="Trap" noClose>
                <button>um</button>
                <button>dois</button>
            </Modal>,
        );

        const dialog = screen.getByRole("dialog");
        const um = screen.getByRole("button", { name: "um" });
        const dois = screen.getByRole("button", { name: "dois" });

        dois.focus();
        fireEvent.keyDown(dialog, { key: "Tab" });
        expect(document.activeElement).toBe(um);

        um.focus();
        fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
        expect(document.activeElement).toBe(dois);
    });

    it("minimizar preserva o conteúdo montado e o chip restaura", () => {
        render(
            <Modal open onClose={vi.fn()} title="Mini" minimizable>
                <input aria-label="campo" defaultValue="" />
            </Modal>,
        );

        fireEvent.change(screen.getByLabelText("campo"), { target: { value: "digitado" } });
        fireEvent.click(screen.getByRole("button", { name: "Minimizar" }));

        // Oculto (display:none), mas montado — estado preservado.
        expect(screen.getByRole("dialog", { hidden: true })).not.toBeVisible();
        expect(screen.getByLabelText("campo")).toHaveValue("digitado");
        expect(getOverlay().getAttribute("data-minimized")).toBe("true");

        fireEvent.click(screen.getByRole("button", { name: /Restaurar Mini/ }));

        expect(screen.getByLabelText("campo")).toBeVisible();
        expect(screen.getByLabelText("campo")).toHaveValue("digitado");
        expect(getOverlay().getAttribute("data-minimized")).toBe("false");
    });

    it("enquanto minimizado, Escape restaura em vez de fechar", () => {
        const onClose = vi.fn();
        render(
            <Modal open onClose={onClose} title="Mini" minimizable>
                <input aria-label="campo" defaultValue="" />
            </Modal>,
        );

        fireEvent.click(screen.getByRole("button", { name: "Minimizar" }));
        fireEvent.keyDown(getOverlay(), { key: "Escape" });

        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog")).toBeVisible();
    });

    it("não exibe chip quando não é minimizável", () => {
        render(
            <Modal open onClose={vi.fn()} title="Simples">
                <p>Conteúdo</p>
            </Modal>,
        );

        expect(screen.queryByRole("button", { name: /Restaurar/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Minimizar" })).not.toBeInTheDocument();
    });
});
