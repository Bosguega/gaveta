import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IdleScreen } from "./IdleScreen";

describe("IdleScreen", () => {
  it("uses the QR image handler for Foto and the AI image handler for Galeria", () => {
    const onFileUpload = vi.fn();
    const onGalleryUpload = vi.fn();

    render(
      <IdleScreen
        onStartCamera={vi.fn()}
        onFileUpload={onFileUpload}
        onGalleryUpload={onGalleryUpload}
        onManualMode={vi.fn()}
        handleUrlSubmit={vi.fn()}
        handleTextSubmit={vi.fn()}
        isLoading={false}
        isScanning={false}
        error={null}
      />,
    );

    const photoInput = screen.getByLabelText("Foto");
    const galleryInput = screen.getByLabelText("Galeria");
    const file = new File(["image"], "receipt.png", { type: "image/png" });

    fireEvent.change(photoInput, { target: { files: [file] } });
    fireEvent.change(galleryInput, { target: { files: [file] } });

    expect(onFileUpload).toHaveBeenCalledTimes(1);
    expect(onGalleryUpload).toHaveBeenCalledTimes(1);
  });
});
