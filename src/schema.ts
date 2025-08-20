import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const emoticon = sqliteTable('emoticon', {
    emoticonId: integer('emoticon_id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    icon: text('icon').notNull(),
    archiveUrl: text('archive_url').notNull(),
    archiveSize: integer('archive_size').notNull(),
    animated: integer('animated', { mode: 'boolean' }).notNull(),
    images: text('images', { mode: 'json' })
        .$type<
            {
                keyword: string;
                src: string;
                preview: string;
            }[]
        >()
        .notNull(),
    metadata: text('metadata', { mode: 'json' })
        .$type<EmoticonMetadata>()
        .notNull(),
});
