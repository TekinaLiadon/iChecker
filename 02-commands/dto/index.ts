

export interface IBot {
        start(ctx: any): void;
        help(ctx: any): void;
        online(ctx: any): void;
        search(ctx: any, isShort: boolean): Promise<void>;
        searchFilm(ctx: any): Promise<void>;
        addLink(ctx: any): Promise<void>;
        editDescription(ctx: any): Promise<void>;
        addPhoto(ctx: any): Promise<void>;
        createTable(ctx: any): Promise<void>;
        nextAgent(ctx: any): Promise<void>;
        getDescriptionKeyboard(fieldNumber: number): { text: string; callback_data: string }[][];
        startEditDescription(ctx: any): Promise<void>;
        saveDescription(ctx: any): Promise<void>;
}