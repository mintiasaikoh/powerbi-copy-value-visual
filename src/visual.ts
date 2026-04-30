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
    private contextMenu: HTMLElement | null = null;
    private dismissContextMenu: (() => void) | null = null;

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

        // text 型で保存された選択列名を取得（確実に永続化される）
        const savedColName = dataView?.metadata?.objects
            ?.["displaySettings"]?.["copyColumnName"] as string ?? "";

        this.render(dataView, savedColName);
    }

    private render(dataView: DataView, selectedColName: string): void {
        this.target.innerHTML = "";
        this.copyTimeouts.clear();
        this.removeContextMenu();
        this.target.style.cssText = "display:flex;flex-direction:column;height:100%;overflow:hidden;";

        const disp = this.formattingSettings.displaySettings;
        const btn = this.formattingSettings.buttonSettings;
        const fontSize = Math.max(10, Math.min(Number(disp.fontSize.value) || 14, 32));

        if (!dataView?.table?.rows?.length) {
            const placeholder = document.createElement("div");
            placeholder.className = "placeholder";
            placeholder.textContent = "対象がありません";
            placeholder.style.fontSize = `${fontSize}px`;
            this.target.appendChild(placeholder);
            return;
        }

        const rows = dataView.table.rows as powerbi.PrimitiveValue[][];
        const columns = dataView.table.columns;
        const separatorValue = (disp.separator.value as { value: string })?.value ?? "tab";
        const separator = this.getSeparatorChar(separatorValue);

        // 列セレクター（ビジュアル内 <select>）
        const selectorBar = this.buildColumnSelector(columns, selectedColName, fontSize);
        this.target.appendChild(selectorBar);

        // 選択列インデックス
        const targetColIdx = selectedColName === ""
            ? -1
            : columns.findIndex(c => c.displayName === selectedColName);

        const table = document.createElement("div");
        table.className = "cv-table";

        // ヘッダー
        const header = document.createElement("div");
        header.className = "cv-header";
        columns.forEach((col, colIdx) => {
            const cell = document.createElement("div");
            cell.className = "cv-cell cv-header-cell";
            cell.style.fontSize = `${fontSize}px`;
            const isTarget = targetColIdx === colIdx;
            cell.textContent = col.displayName + (isTarget ? " ★" : "");
            if (isTarget) cell.classList.add("cv-col-target");
            header.appendChild(cell);
        });
        header.appendChild(this.makeCell("cv-btn-cell cv-header-cell", ""));
        table.appendChild(header);

        // データ行
        rows.forEach((row, rowIndex) => {
            const rowEl = document.createElement("div");
            rowEl.className = "cv-row" + (rowIndex % 2 === 1 ? " cv-row-alt" : "");

            row.forEach((val, colIdx) => {
                const cell = document.createElement("div");
                cell.className = "cv-cell";
                if (targetColIdx === colIdx) cell.classList.add("cv-col-target");
                const cellText = this.formatValue(val);
                cell.textContent = cellText;
                cell.style.fontSize = `${fontSize}px`;
                cell.title = cellText;
                cell.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    const rowText = (targetColIdx >= 0 && targetColIdx < row.length)
                        ? this.formatValue(row[targetColIdx])
                        : row.map(v => this.formatValue(v)).join(separator);
                    this.showContextMenu(e, cellText, rowText, cellText === rowText);
                });
                rowEl.appendChild(cell);
            });

            const copyBtn = document.createElement("button");
            copyBtn.className = "cv-copy-btn";
            copyBtn.textContent = btn.buttonText.value || "コピー";
            copyBtn.style.backgroundColor = btn.backgroundColor.value.value || "#0078d4";
            copyBtn.style.color = btn.fontColor.value.value || "#ffffff";
            copyBtn.style.fontSize = `${Math.max(10, fontSize - 2)}px`;

            const copyText = (targetColIdx >= 0 && targetColIdx < row.length)
                ? this.formatValue(row[targetColIdx])
                : row.map(v => this.formatValue(v)).join(separator);
            copyBtn.addEventListener("click", () =>
                this.handleCopy(copyBtn, copyText, btn.buttonText.value || "コピー")
            );

            const btnCell = document.createElement("div");
            btnCell.className = "cv-cell cv-btn-cell";
            btnCell.appendChild(copyBtn);
            rowEl.appendChild(btnCell);
            table.appendChild(rowEl);
        });

        this.target.appendChild(table);
    }

    private buildColumnSelector(
        columns: powerbi.DataViewMetadataColumn[],
        selectedColName: string,
        fontSize: number
    ): HTMLElement {
        const bar = document.createElement("div");
        bar.className = "cv-selector-bar";

        const label = document.createElement("span");
        label.className = "cv-selector-label";
        label.textContent = "コピーする列:";
        label.style.fontSize = `${Math.max(10, fontSize - 2)}px`;

        const select = document.createElement("select");
        select.className = "cv-column-select";
        select.style.fontSize = `${Math.max(10, fontSize - 2)}px`;

        const allOption = document.createElement("option");
        allOption.value = "";
        allOption.textContent = "全列";
        if (selectedColName === "") allOption.selected = true;
        select.appendChild(allOption);

        columns.forEach(col => {
            const option = document.createElement("option");
            option.value = col.displayName;
            option.textContent = col.displayName;
            if (col.displayName === selectedColName) option.selected = true;
            select.appendChild(option);
        });

        select.addEventListener("change", () => {
            this.host.persistProperties({
                merge: [{
                    objectName: "displaySettings",
                    selector: null,
                    properties: { copyColumnName: select.value },
                }],
            });
        });

        bar.appendChild(label);
        bar.appendChild(select);
        return bar;
    }

    private showContextMenu(e: MouseEvent, cellText: string, rowText: string, isSame: boolean): void {
        this.removeContextMenu();

        const menu = document.createElement("div");
        menu.className = "cv-context-menu";
        menu.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;z-index:9999;`;

        const addItem = (label: string, text: string): void => {
            const item = document.createElement("div");
            item.className = "cv-context-item";
            item.textContent = label;
            item.addEventListener("click", () => {
                this.copyText(text);
                this.removeContextMenu();
            });
            menu.appendChild(item);
        };

        addItem("セルをコピー", cellText);
        if (!isSame) addItem("行をコピー", rowText);

        document.body.appendChild(menu);
        this.contextMenu = menu;

        const dismiss = () => this.removeContextMenu();
        this.dismissContextMenu = dismiss;
        setTimeout(() => document.addEventListener("click", dismiss, { once: true }), 0);
    }

    private removeContextMenu(): void {
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }
        if (this.dismissContextMenu) {
            document.removeEventListener("click", this.dismissContextMenu);
            this.dismissContextMenu = null;
        }
    }

    private async copyText(text: string): Promise<void> {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                this.fallbackCopy(text);
            }
        } catch {
            try { this.fallbackCopy(text); } catch (err) {
                console.error("[CopyValueVisual] コピー失敗:", err);
            }
        }
    }

    private makeCell(className: string, text: string): HTMLElement {
        const cell = document.createElement("div");
        cell.className = `cv-cell ${className}`;
        cell.textContent = text;
        return cell;
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
