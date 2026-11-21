import { db } from "@/db";
import { users } from "@/db/schema";

/** The app's record of a person, made the first time they are seen. */
export async function rememberUser(user: { id: string; email: string }) {
  await db
    .insert(users)
    .values({ id: user.id, email: user.email })
    .onConflictDoUpdate({ target: users.id, set: { email: user.email } });
}
