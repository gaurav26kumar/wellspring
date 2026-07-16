/**
 * NOT PORTED YET.
 *
 * wellspring-community.html has the full design (room list, anonymized
 * handles, human-moderation messaging, always-visible crisis resources).
 * None of it has a backend yet, unlike Growth — this needs new routes
 * before it can be wired up for real:
 *
 *   - A `rooms` collection (or a fixed config list, if rooms aren't
 *     user-created) and a `room_posts` collection.
 *   - POST /api/v1/rooms/:id/posts — this is NOT the same as chat.routes.js.
 *     No safety agent gating an individual message the same way; instead
 *     it needs its own moderation queue model (a `reports` collection,
 *     reviewed by humans, matching the "moderated by humans, not the AI
 *     safety layer" framing in the mockup). Don't reuse safetyAgent.js
 *     here without thinking through what changes for a peer-to-peer,
 *     many-readers context.
 *   - Anonymization: generate the pseudonym server-side and store it
 *     against userId (not regenerate randomly per session like the demo
 *     does), or a moderator can never map a report back to an account.
 */
export function CommunityPage() {
  return (
    <div className="pt-16 text-center text-[var(--mist)]">
      <div className="font-display italic text-2xl text-[var(--paper)] mb-3">Community rooms — not ported yet</div>
      <p className="max-w-md mx-auto text-sm leading-relaxed">
        This one needs new backend routes and its own moderation model first — see the comment at the top of this
        file. The design reference is <code className="text-[var(--line-teal)]">wellspring-community.html</code>.
      </p>
    </div>
  );
}
