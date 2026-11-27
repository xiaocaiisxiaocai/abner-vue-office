export interface ExtendToolbarOption {
  tip?: string;
  el?: HTMLElement;
  icon?: string;
  onClick?: (data: SheetData[], dataProxy: any) => void;
}

export interface Options {
  mode?: 'edit' | 'read';
  evalPaused?: boolean;
  showToolbar?: boolean;
  showGrid?: boolean;
  showContextmenu?: boolean;
  showBottomBar?: boolean;
  extendToolbar?: {
    left?: ExtendToolbarOption[];
    right?: ExtendToolbarOption[];
  };
  autoFocus?: boolean;
  view?: {
    height?: () => number;
    width?: () => number;
  };
  row?: {
    len?: number;
    height?: number;
  };
  col?: {
    len?: number;
    width?: number;
    indexWidth?: number;
    minWidth?: number;
  };
  style?: {
    bgcolor?: string;
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
    textwrap?: boolean;
    strike?: boolean;
    underline?: boolean;
    color?: string;
    format?: string;
    font?: {
      name?: string;
      size?: number;
      bold?: boolean;
      italic?: boolean;
    };
  };
}

export type CELL_SELECTED = 'cell-selected';
export type CELLS_SELECTED = 'cells-selected';
export type CELL_EDITED = 'cell-edited';
export type SHEET_CHANGE = 'change';
export type PASTED_CLIPBOARD = 'pasted-clipboard';

export type CellMerge = [number, number];

export interface SpreadsheetEventHandler {
  (
    evt: CELL_SELECTED,
    callback: (cell: CellData | null, rowIndex: number, colIndex: number) => void
  ): Spreadsheet;
  (
    evt: CELLS_SELECTED,
    callback: (
      cell: CellData | null,
      parameters: { sri: number; sci: number; eri: number; eci: number }
    ) => void
  ): Spreadsheet;
  (
    evt: CELL_EDITED,
    callback: (text: string, rowIndex: number, colIndex: number) => void
  ): Spreadsheet;
  (
    evt: SHEET_CHANGE,
    callback: (json: SheetData | undefined) => void
  ): Spreadsheet;
  (
    evt: PASTED_CLIPBOARD,
    callback: (rows: Record<string, any>) => void
  ): Spreadsheet;
}

export interface ColProperties {
  width?: number;
  hide?: boolean;
  style?: number;
}

export interface CellData {
  text?: string | number;
  style?: number;
  merge?: CellMerge;
  editable?: boolean;
  printable?: boolean;
}

export interface RowData {
  height?: number;
  hide?: boolean;
  style?: number;
  cells: {
    [key: number]: CellData;
  };
}

export interface SheetData {
  name?: string;
  freeze?: string | [number, number];
  styles?: CellStyle[];
  merges?: string[];
  validations?: any[];
  autofilter?: Record<string, any>;
  cols?: {
    len?: number;
    [key: number]: ColProperties;
  };
  rows?: {
    len?: number;
    [key: number]: RowData;
  };
  [key: string]: any;
}

export type SpreadsheetData = SheetData[];

export interface CellStyle {
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  font?: {
    name?: string;
    size?: number;
    bold?: boolean;
    italic?: boolean;
  };
  bgcolor?: string;
  textwrap?: boolean;
  strike?: boolean;
  underline?: boolean;
  format?: string;
  color?: string;
  border?: {
    top?: string[];
    right?: string[];
    bottom?: string[];
    left?: string[];
  };
}

export default class Spreadsheet {
  options: Options;
  datas: any[];
  data: any;
  sheet: any;
  bottombar: any;
  rootEl: any;
  constructor(container: string | HTMLElement, opts?: Options);
  addSheet(name?: string, active?: boolean): any;
  on: SpreadsheetEventHandler;
  cell(rowIndex: number, colIndex: number, sheetIndex?: number): CellData | null;
  cellStyle(rowIndex: number, colIndex: number, sheetIndex?: number): CellStyle | null;
  cellText(rowIndex: number, colIndex: number, text: string | number, sheetIndex?: number): this;
  deleteSheet(): void;
  loadData(data: SheetData | SheetData[]): this;
  getData(): SheetData[];
  reRender(): this;
  validate(): boolean;
  change(callback: (json: SheetData | undefined) => void): this;
  destroy(): void;
  static locale(lang: string, message?: object, clearLangList?: boolean): void;
}

export function spreadsheet(container: string | HTMLElement, opts?: Options): Spreadsheet;
