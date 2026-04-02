

export interface IBot {
        start(ctx: any): Promise<void>;
        help(ctx: any): Promise<void>;
        online(ctx: any): Promise<void>;
        search(ctx: any, isShort: boolean): Promise<void>;
        searchFilm(ctx: any): Promise<void>;
        addLink(ctx: any): Promise<void>;
        editDescription(ctx: any): Promise<void>;
        addPhoto(ctx: any): Promise<void>;
        createTable(ctx: any): Promise<void>;
        nextAgent(ctx: any): Promise<void>;
}