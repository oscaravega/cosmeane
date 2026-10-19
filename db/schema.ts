import {sqliteTable,text,integer,uniqueIndex} from 'drizzle-orm/sqlite-core';
import {sql} from 'drizzle-orm';
export const studySessions=sqliteTable('study_sessions',{
 id:text('id').primaryKey(),quizId:text('quiz_id').notNull(),title:text('title').notNull(),questions:text('questions').notNull(),answers:text('answers').notNull().default('[]'),position:integer('position').notNull().default(0),completed:integer('completed').notNull().default(0),updatedAt:text('updated_at').notNull(),revision:integer('revision').notNull().default(0)
});

export const studyLessons=sqliteTable("study_lessons",{lessonId:text("lesson_id").primaryKey(),completed:integer("completed").notNull().default(0),updatedAt:text("updated_at").notNull()});

export const finalExamSessions=sqliteTable('final_exam_sessions',{
 id:text('id').primaryKey(),status:text('status').notNull().default('draft'),
 questions:text('questions').notNull(),answers:text('answers').notNull().default('{}'),
 assessments:text('assessments').notNull().default('{}'),cursor:integer('cursor').notNull().default(0),
 revision:integer('revision').notNull().default(0),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
},table=>[uniqueIndex('one_draft_final_exam').on(table.status).where(sql`${table.status} = 'draft'`)]);
