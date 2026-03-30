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
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private copyTimeouts: Map<HTMLButtonElement, ReturnType<typeof setTimeout>> = new Map();

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.target = options.element;
        this.formattingSettingsService = new FormattingSettingsService();
    }

    public update(options: VisualUpdateOptions): void {
        const dataView: DataView = options.dataViews && options.dataViews[0];

        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel,
            dataView
        );

        this.render(dataView);
    }

    private render(dataView: DataView): void {
        this.target.innerHTML = "";
        this.copyTimeouts.clear();

        const disp = this.formattingSettings.displaySettings;
        const btn = this.formattingSettings.buttonSettings;
        const fontSize = Math.max(10, Math.min(Number(disp.fontSize.value) || 14, 32));

        if (!dataView?.table?.rows?.length) {
            const placeholder = document.createElement("div");
            placeholder.className = "placeholder";
            placeholder.textContent = "テーブルから行を選択してください";
            placeholder.style.fontSize = `${fontSize}px`;
            this.target.appendChild(placeholder);
            return;
        }

        const rows = dataView.table.rows as powerbi.PrimitiveValue[][];
        const columns = dataView.table.columns;
        const separatorValue = (disp.separator.value as { value: string })?.value ?? "tab";
        const separator = this.getSeparatorChar(separatorValue);
        const copyColIndex = Number(disp.copyColumnIndex.value) || 0; // 0=全列, 1始まり

        const table = document.createElement("div");
        table.className = "cv-table";

        // ヘッダー
        const header = document.createElement("div");
        header.className = "cv-header";
        columns.forEach((col, colIdx) => {
            const cell = document.createElement("div");
            cell.className = "cv-cell cv-header-cell";
            cell.style.fontSize = `${fontSize}px`;
            const isTarget = copyColIndex > 0 && copyColIndex === colIdx + 1;
            cell.textContent = col.displayName + (isTarget ? " ★" : "");
            if (isTarget) cell.classList.add("cv-col-target");
            header.appendChild(cell);
        });
        const headerBtn = document.createElement("div");
        headerBtn.className = "cv-cell cv-btn-cell cv-header-cell";
        header.appendChild(headerBtn);
        table.appendChild(header);

        // データ行
        rows.forEach((row, rowIndex) => {
            const rowEl = document.createElement("div");
            rowEl.className = "cv-row" + (rowIndex % 2 === 1 ? " cv-row-alt" : "");

            row.forEach((val, colIdx) => {
                const cell = document.createElement("div");
                cell.className = "cv-cell";
                const isTarget = copyColIndex > 0 && copyColIndex === colIdx + 1;
                if (isTarget) cell.classList.add("cv-col-target");
                cell.textContent = this.formatValue(val);
                cell.style.fontSize = `${fontSize}px`;
                cell.title = this.formatValue(val);
                rowEl.appendChild(cell);
            });

            const btnCell = document.createElement("div");
            btnCell.className = "cv-cell cv-btn-cell";

            const copyBtn = document.createElement("button");
            copyBtn.className = "cv-copy-btn";
            copyBtn.textContent = btn.buttonText.value || "コピー";
            copyBtn.style.backgroundColor = btn.backgroundColor.value.value || "#0078d4";
            copyBtn.style.color = btn.fontColor.value.value || "#ffffff";
            copyBtn.style.fontSize = `${Math.max(10, fontSize - 2)}px`;

            let copyText: string;
            if (copyColIndex > 0 && copyColIndex <= row.length) {
                // 指定列のみ
                copyText = this.formatValue(row[copyColIndex - 1]);
            } else {
                // 全列（デフォルト）
                copyText = row.map(v => this.formatValue(v)).join(separator);
            }
            copyBtn.addEventListener("click", () => this.handleCopy(copyBtn, copyText, btn.buttonText.value || "コピー"));

            btnCell.appendChild(copyBtn);
            rowEl.appendChild(btnCell);
            table.appendChild(rowEl);
        });

        this.target.appendChild(table);
    }

    private async handleCopy(btn: HTMLButtonElement, text: string, originalLabel: string): Promise<void> {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                this.fallbackCopy(text);
            }
            this.showCopyFeedback(btn, originalLabel);
        } catch {
            try {
                this.fallbackCopy(text);
                this.showCopyFeedback(btn, originalLabel);
            } catch (err) {
                console.error("[CopyValueVisual] コピー失敗:", err);
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

    private showCopyFeedback(btn: HTMLButtonElement, originalLabel: string): void {
        const existing = this.copyTimeouts.get(btn);
        if (existing !== undefined) clearTimeout(existing);
        btn.textContent = "✓";
        btn.classList.add("copied");
        const id = setTimeout(() => {
            btn.textContent = originalLabel;
            btn.classList.remove("copied");
            this.copyTimeouts.delete(btn);
        }, 2000);
        this.copyTimeouts.set(btn, id);
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
