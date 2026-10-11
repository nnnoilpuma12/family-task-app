import { useRef } from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDialogAccessibility } from "@/hooks/use-dialog-accessibility";

function Dialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogAccessibility(true, onClose, ref);
  return <div ref={ref} role="dialog" tabIndex={-1}><button>操作</button></div>;
}

describe("useDialogAccessibility", () => {
  it("重なったダイアログでは最前面だけ Escape を受け、最後までスクロールをロックする", () => {
    const closeParent = vi.fn();
    const closeChild = vi.fn();
    document.body.style.overflow = "auto";
    const parent = render(<Dialog onClose={closeParent} />);
    const child = render(<Dialog onClose={closeChild} />);
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closeChild).toHaveBeenCalledTimes(1);
    expect(closeParent).not.toHaveBeenCalled();
    child.unmount();
    expect(document.body.style.overflow).toBe("hidden");
    parent.unmount();
    expect(document.body.style.overflow).toBe("auto");
    document.body.style.overflow = "";
  });
});
