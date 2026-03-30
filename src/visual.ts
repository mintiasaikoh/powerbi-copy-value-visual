"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;

import { VisualFormattingSettingsModel } from "./settings";
import "./../style/visual.less";

export class Visual implements IVisual {
    private host: IVisualHost;
    private target: HTMLElement;
    private container: HTMLElement;
    private valueDisplay: HTMLElement;
    private copyButton: HTMLButtonElement;
    private rowCountLabel: HTMLElement;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private currentRows: powerbi.PrimitiveValue[][] = [];
    private copyTimeoutId: ReturnType<typeof setTimeout> | null = null;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.target = options.element;
        this.formattingSettingsService = new FormattingSettingsService();
        this.buildDOM();
    }

    private buildDOM(): void {
        this.container = document.createElement("div");
        this.container.className = "copy-value-visual";

        this.rowCountLabel = document.createElement("div");
        this.rowCountLabel.className = "row-count-label";
        this.rowCountLabel.style.display = "none";

        this.valueDisplay = document.createElement("div");
        this.valueDisplay.className = "value-display placeholder";
        this.valueDisplay.textContent = "テーブルから行を選択してください";

        this.copyButton = document.createElement("button");
        this.copyButton.className = "copy-button";
        this.copyButton.textContent = "値をコピー";
        this.copyButton.disabled = true;
        this.copyButton.addEventListener("click", () => this.handleCopy());

        this.container.appendChild(this.rowCountLabel);
        this.container.appendChild(this.valueDisplay);
        this.container.appendChild(this.copyButton);
        this.target.appendChild(this.container);
    }

    public update(options: VisualUpdateOptions): void {
        const dataView: DataView = options.dataViews && options.dataViews[0];

        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel,
            dataView
        );

        this.applySettings();

        if (!dataView?.table?.rows?.length) {
            this.showPlaceholder();
            return;
        }

        this.currentRows = dataView.table.rows as powerbi.PrimitiveValue[][];
        this.renderValues(dataView);
    }

    private applySettings(): void {
        const btn = this.formattingSettings.buttonSettings;
        const disp = this.formattingSettings.displaySettings;

        this.copyButton.textContent = btn.buttonText.value || "値をコピー";
        this.copyButton.style.backgroundColor = btn.backgroundColor.value.value || "#0078d4";
        this.copyButton.style.color = btn.fontColor.value.value || "#ffffff";

        const fontSize = Math.max(10, Math.min(Number(disp.fontSize.value) || 14, 32));
        this.valueDisplay.style.fontSize = `${fontSize}px`;
        this.copyButton.style.fontSize = `${fontSize}px`;
    }

    private renderValues(dataView: DataView): void {
        const disp = this.formattingSettings.displaySettings;
        const separatorValue = (disp.separator.value as { value: string })?.value ?? "tab";
        const separator = this.getSeparatorChar(separatorValue);
        const rows = this.currentRows;

        if (rows.length > 1) {
            this.rowCountLabel.textContent = `${rows.length} 行選択中`;
            this.rowCountLabel.style.display = "block";
        } else {
            this.rowCountLabel.style.display = "none";
        }

        if (disp.showValues.value) {
            const lines = rows.map(row =>
                row.map(v => this.formatValue(v)).join(separator)
            );
            this.valueDisplay.textContent = lines.join("\n");
            this.valueDisplay.classList.remove("placeholder");
            this.valueDisplay.style.display = "block";
        } else {
            this.valueDisplay.style.display = "none";
        }

        this.copyButton.disabled = false;
    }

    private showPlaceholder(): void {
        this.currentRows = [];
        this.rowCountLabel.style.display = "none";
        this.valueDisplay.textContent = "テーブルから行を選択してください";
        this.valueDisplay.classList.add("placeholder");
        this.valueDisplay.style.display = "block";
        this.copyButton.disabled = true;

        const btnText = this.formattingSettings?.buttonSettings?.buttonText?.value;
        this.copyButton.textContent = btnText || "値をコピー";
    }

    private async handleCopy(): Promise<void> {
        if (this.currentRows.length === 0) return;

        const separatorValue = (this.formattingSettings.displaySettings.separator.value as { value: string })?.value ?? "tab";
        const separator = this.getSeparatorChar(separatorValue);
        const lines = this.currentRows.map(row =>
            row.map(v => this.formatValue(v)).join(separator)
        );
        const text = lines.join("\r\n");

        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                this.fallbackCopy(text);
            }
            this.showCopyFeedback();
        } catch {
            try {
                this.fallbackCopy(text);
                this.showCopyFeedback();
            } catch (fallbackErr) {
                console.error("[CopyValueVisual] コピー失敗:", fallbackErr);
            }
        }
    }

    private fallbackCopy(text: string): void {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!success) throw new Error("execCommand('copy') failed");
    }

    private showCopyFeedback(): void {
        if (this.copyTimeoutId !== null) clearTimeout(this.copyTimeoutId);
        this.copyButton.textContent = "コピーしました ✓";
        this.copyButton.classList.add("copied");
        this.copyTimeoutId = setTimeout(() => {
            const btnText = this.formattingSettings?.buttonSettings?.buttonText?.value;
            this.copyButton.textContent = btnText || "値をコピー";
            this.copyButton.classList.remove("copied");
            this.copyTimeoutId = null;
        }, 2000);
    }

    private getSeparatorChar(separator: string): string {
        switch (separator) {
            case "comma": return ",";
            case "pipe": return "|";
            default: return "\t";
        }
    }

    private formatValue(value: powerbi.PrimitiveValue): string {
        if (value === null || value === undefined) return "";
        if (value instanceof Date) return value.toLocaleDateString("ja-JP");
        return String(value);
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
