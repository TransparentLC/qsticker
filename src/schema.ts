import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const emoticon = sqliteTable('emoticon', {
    emoticonId: integer('emoticon_id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    icon: text('icon').notNull(),
    updateTime: text('update_time')
        .$defaultFn(() => new Date(0).toISOString())
        .notNull(),
    source: text('source', { enum: ['qq'] }).notNull(),
    animated: integer('animated', { mode: 'boolean' }).notNull(),
    archiveUrl: text('archive_url').notNull(),
    archiveSize: integer('archive_size').notNull(),
});

export const emoticonImage = sqliteTable('emoticon_image', {
    emoticonImageId: integer('emoticon_image_id').primaryKey(),
    emoticonId: integer('emoticon_id')
        .references(() => emoticon.emoticonId)
        .notNull(),
    keyword: text('keyword').notNull(),
    animated: integer('animated', { mode: 'boolean' }).notNull(),
    url: text('url').notNull(),
    preview: text('preview'),
});
