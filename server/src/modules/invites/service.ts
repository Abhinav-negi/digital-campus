import { config } from '../../config.js';
import { newToken } from '../../lib/auth.js';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { sendMail } from '../../lib/mail.js';

const INVITE_MS = 14 * 86_400_000; // SPEC §6

type InviteInput = { email: string; role: 'student' | 'staff'; classId?: string; invitedById: string };

/**
 * Internal only (CS-02 students, AD-01 staff); no route creates invites directly.
 * The caller creates the `invited` User first (name, homeClassId, studentIdNo, …); this issues the single-use link and emails it.
 * Re-inviting a pending email replaces its token (the resend). An email with an active/disabled account → 409 ACCOUNT_EXISTS.
 */
export const createInvite = async ({ email, role, classId, invitedById }: InviteInput) => {
  email = email.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email }, select: { status: true } });
  if (!user) throw new Error(`createInvite: create the invited User for ${email} first`);
  if (user.status !== 'invited') throw new HttpError(409, 'ACCOUNT_EXISTS', `${email} already has an account`);

  const { token, tokenHash } = newToken();
  const [, invite] = await db.$transaction([
    db.invite.deleteMany({ where: { email, acceptedAt: null } }),
    db.invite.create({
      data: { email, role, classId: classId ?? null, invitedById, tokenHash, expiresAt: new Date(Date.now() + INVITE_MS) },
      include: { invitedBy: { select: { name: true } }, class: { select: { name: true } } },
    }),
  ]);

  const link = `${config.APP_URL}/invite/${token}`;
  const by = invite.invitedBy.name;
  const [subject, intro] = invite.class
    ? [`Your class ${invite.class.name} is on Digital Campus`, `${by} added you to ${invite.class.name} on Digital Campus.`]
    : ['You are invited to Digital Campus', `${by} invited you to join the staff on Digital Campus.`];
  await sendMail(email, subject, `Hi,\n\n${intro} Set a password to get in:\n\n${link}\n\nThe link works once and expires in 14 days.\n`);
  return { id: invite.id, expiresAt: invite.expiresAt };
};
