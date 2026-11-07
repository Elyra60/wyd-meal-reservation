import { sqliteTable, text, integer, real, uniqueIndex, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const users = sqliteTable('users', {id:text('id').primaryKey(),username:text('username').unique(),usernameChangedAt:integer('username_changed_at'),email:text('email').notNull().unique(),password:text('password').notNull(),role:text('role').notNull().default('user'),mustChange:integer('must_change').notNull().default(0),canManage:integer('can_manage').notNull().default(0),nickname:text('nickname').notNull().default(''),disabled:integer('disabled').notNull().default(0),avatarKey:text('avatar_key')});
export const sessions = sqliteTable('sessions',{token:text('token').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),expires:integer('expires').notNull()});
export const challenges = sqliteTable('challenges',{email:text('email').primaryKey(),code:text('code').notNull(),purpose:text('purpose').notNull(),expires:integer('expires').notNull()});
export const rates = sqliteTable('rates',{key:text('key').primaryKey(),count:integer('count').notNull()});
export const bookings = sqliteTable('bookings',{id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),name:text('name').notNull(),restaurant:text('restaurant').notNull(),mealAt:text('meal_at').notNull(),week:text('week').notNull(),status:text('status').notNull().default('pending'),reason:text('reason'),created:text('created').notNull(),cancelledBy:text('cancelled_by'),completedAt:text('completed_at'),completionMethod:text('completion_method'),mealType:text('meal_type').notNull().default('unspecified'),partySize:integer('party_size').notNull().default(2),companions:text('companions'),contact:text('contact'),notes:text('notes'),address:text('address'),latitude:real('latitude'),longitude:real('longitude'),transportMode:text('transport_mode').notNull().default(''),estimatedCostCents:integer('estimated_cost_cents'),revision:integer('revision').notNull().default(0),source:text('source').notNull().default('reservation'),calories:integer('calories'),coordinateSystem:text('coordinate_system').notNull().default('wgs84')});
export const approvals=sqliteTable('approvals',{bookingId:text('booking_id').primaryKey().references(()=>bookings.id),week:text('week').notNull(),slot:integer('slot').notNull()},t=>[uniqueIndex('week_slot').on(t.week,t.slot)]);
export const notices=sqliteTable('notices',{id:integer('id').primaryKey({autoIncrement:true}),userId:text('user_id').notNull().references(()=>users.id),bookingId:text('booking_id'),message:text('message').notNull(),created:text('created').notNull(),read:integer('read').notNull().default(0)});

export const weeklyLimits=sqliteTable('weekly_limits',{week:text('week').primaryKey(),limit:integer('meal_limit').notNull()});
export const auditLog=sqliteTable('audit_log',{id:integer('id').primaryKey({autoIncrement:true}),actor:text('actor').notNull(),action:text('action').notNull(),target:text('target').notNull(),details:text('details').notNull(),created:text('created').notNull()});

export const avatars=sqliteTable('avatars',{key:text('key').primaryKey(),data:text('data').notNull(),contentType:text('content_type').notNull()});

export const mailOutbox=sqliteTable('mail_outbox',{id:integer('id').primaryKey({autoIncrement:true}),noticeId:integer('notice_id').notNull().unique().references(()=>notices.id),recipient:text('recipient').notNull(),subject:text('subject').notNull(),body:text('body').notNull(),status:text('status').notNull().default('pending'),attempts:integer('attempts').notNull().default(0),nextAttempt:integer('next_attempt').notNull().default(0),firstAttempt:integer('first_attempt'),leaseToken:text('lease_token'),leaseUntil:integer('lease_until'),lastError:text('last_error'),sentAt:text('sent_at')});

export const mealReviews = sqliteTable('meal_reviews', {
 id:text('id').primaryKey().notNull(),
 requesterId:text('requester_id').notNull().references(()=>users.id),
 food:text('food').notNull(),
 calories:integer('calories').notNull(),
 deadline:integer('deadline').notNull(),
 created:text('created').notNull(),
 result:text('result',{enum:['open','allowed','denied']}).notNull().default('open'),
},table=>[index('meal_reviews_due').on(table.result,table.deadline)]);

export const mealReviewVotes = sqliteTable('meal_review_votes', {
 reviewId:text('review_id').notNull().references(()=>mealReviews.id),
 userId:text('user_id').notNull().references(()=>users.id),
 choice:text('choice',{enum:['yes','no']}).notNull(),
},table=>[primaryKey({columns:[table.reviewId,table.userId]})]);

export const mealReviewComments = sqliteTable('meal_review_comments', {
 id:integer('id').primaryKey({autoIncrement:true}),
 reviewId:text('review_id').notNull().references(()=>mealReviews.id),
 userId:text('user_id').notNull().references(()=>users.id),
 body:text('body').notNull(),
 created:text('created').notNull(),
},table=>[index('meal_review_comments_thread').on(table.reviewId,table.id)]);
