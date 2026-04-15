import type { GameObjects, Scene } from 'phaser';

export interface TextBoundsOptions {
    width: number;
    height?: number;
    minFontSize?: number;
    lineSpacing?: number;
    maxLines?: number;
    ellipsis?: string;
}

export interface AddBoundedTextOptions extends TextBoundsOptions {
    x: number;
    y: number;
    content: string | string[];
    style?: Phaser.Types.GameObjects.Text.TextStyle;
    originX?: number;
    originY?: number;
}

export function addBoundedText(scene: Scene, options: AddBoundedTextOptions): GameObjects.Text {
    const text = scene.add.text(options.x, options.y, options.content, options.style ?? {});
    text.setOrigin(options.originX ?? 0, options.originY ?? 0);
    fitTextToBounds(text, options);
    return text;
}

export function fitTextToBounds(text: GameObjects.Text, options: TextBoundsOptions): GameObjects.Text {
    const minFontSize = options.minFontSize ?? 10;
    const ellipsis = options.ellipsis ?? '...';
    const initialFontSize = getFontSize(text);

    if (options.lineSpacing !== undefined) {
        text.setLineSpacing(options.lineSpacing);
    }
    text.setWordWrapWidth(options.width, true);

    let fontSize = initialFontSize;
    while (fontSize > minFontSize && exceedsBounds(text, options)) {
        fontSize -= 1;
        text.setFontSize(fontSize);
    }

    if (options.maxLines !== undefined || options.height !== undefined) {
        clampTextLines(text, {
            width: options.width,
            height: options.height,
            maxLines: options.maxLines,
            ellipsis,
        });
    }

    return text;
}

function exceedsBounds(text: GameObjects.Text, options: TextBoundsOptions): boolean {
    return text.width > options.width || (options.height !== undefined && text.height > options.height);
}

function clampTextLines(
    text: GameObjects.Text,
    options: Pick<TextBoundsOptions, 'width' | 'height' | 'maxLines'> & { ellipsis: string },
) {
    const lines = text.getWrappedText(text.text);
    const lineHeight = estimateLineHeight(text);
    const maxLinesByHeight = options.height !== undefined ? Math.max(1, Math.floor(options.height / lineHeight)) : Number.MAX_SAFE_INTEGER;
    const maxLines = Math.max(1, Math.min(options.maxLines ?? Number.MAX_SAFE_INTEGER, maxLinesByHeight));

    if (lines.length <= maxLines) {
        return;
    }

    const visibleLines = lines.slice(0, maxLines);
    visibleLines[maxLines - 1] = trimLineToWidth(text, visibleLines[maxLines - 1], options.width, options.ellipsis);
    text.setText(visibleLines.join('\n'));
}

function trimLineToWidth(text: GameObjects.Text, line: string, width: number, ellipsis: string): string {
    let result = line.trimEnd();
    text.setText(result + ellipsis);
    while (result.length > 0 && text.width > width) {
        result = result.slice(0, -1).trimEnd();
        text.setText(result + ellipsis);
    }
    return result + ellipsis;
}

function getFontSize(text: GameObjects.Text): number {
    const raw = text.style.fontSize;
    if (typeof raw === 'number') return raw;
    const parsed = Number.parseInt(raw ?? '16', 10);
    return Number.isFinite(parsed) ? parsed : 16;
}

function estimateLineHeight(text: GameObjects.Text): number {
    const fontSize = getFontSize(text);
    return fontSize + text.lineSpacing + 4;
}
