import { emitKeypressEvents } from "node:readline";

export type InteractiveSelectOption<T extends string> = {
  value: T;
  label: string;
  description: string;
};

export async function interactiveSelect<T extends string>(opts: {
  title: string;
  prompt: string;
  options: InteractiveSelectOption<T>[];
  defaultValue: T;
  hint?: string;
}): Promise<T> {
  const { title, prompt, options, defaultValue, hint } = opts;

  if (options.length === 0) {
    throw new Error("No options provided.");
  }

  const defaultIndex = Math.max(
    0,
    options.findIndex((option) => option.value === defaultValue)
  );

  const stdin = process.stdin;
  const stdout = process.stdout;

  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== "function") {
    return options[defaultIndex]!.value;
  }

  let selectedIndex = defaultIndex;
  const priorRawMode = stdin.isRaw === true;

  const render = () => {
    const lines: string[] = [];
    lines.push(title);
    lines.push(prompt);
    lines.push("");

    for (const [index, option] of options.entries()) {
      const isSelected = index === selectedIndex;
      const marker = isSelected ? ">" : " ";
      lines.push(`${marker} ${index + 1}) ${option.label}`);
      lines.push(`   ${option.description}`);
    }

    lines.push("");
    lines.push(hint ?? "Use Up/Down arrows + Enter. Number keys also work. Press q or Esc to cancel.");

    stdout.write("\x1b[2J\x1b[H");
    stdout.write(`${lines.join("\n")}\n`);
  };

  return await new Promise<T>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      stdin.off("keypress", onKeyPress);
      stdin.setRawMode(priorRawMode);
      stdout.write("\x1b[?25h");
      stdout.write("\x1b[?1049l");
    };

    const finish = (value: T | null, error: Error | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(value!);
    };

    const move = (delta: number) => {
      selectedIndex = (selectedIndex + delta + options.length) % options.length;
      render();
    };

    const onKeyPress = (chunk: string, key: { ctrl?: boolean; name?: string } | undefined) => {
      const input = chunk ?? "";
      const name = key?.name ?? "";

      if ((key?.ctrl && name === "c") || name === "escape" || input.toLowerCase() === "q") {
        finish(null, new Error("Canceled."));
        return;
      }

      if (name === "up" || input.toLowerCase() === "k") {
        move(-1);
        return;
      }

      if (name === "down" || input.toLowerCase() === "j") {
        move(1);
        return;
      }

      if (name === "return" || name === "enter") {
        finish(options[selectedIndex]!.value, null);
        return;
      }

      if (/^[1-9]$/.test(input)) {
        const nextIndex = Number.parseInt(input, 10) - 1;
        if (nextIndex >= 0 && nextIndex < options.length) {
          selectedIndex = nextIndex;
          render();
          finish(options[selectedIndex]!.value, null);
        }
      }
    };

    emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    stdin.resume();
    stdout.write("\x1b[?1049h");
    stdout.write("\x1b[?25l");
    stdin.on("keypress", onKeyPress);
    render();
  });
}
