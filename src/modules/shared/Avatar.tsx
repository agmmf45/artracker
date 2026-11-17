import type { Profile } from '@/core/hooks';

export function Avatar({ profile, size = 36, name }: { profile: Partial<Profile>; size?: number; name?: string | null }) {
  const label = profile.display_name ?? name ?? '';
  if (profile.avatar_photo) {
    return <img src={profile.avatar_photo} alt={label} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-label={label}
      role="img"
      className="grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, fontSize: size * 0.5, background: profile.avatar_color ?? 'var(--surface-2)' }}
    >
      {profile.avatar_emoji ?? label.slice(0, 1) ?? '😊'}
    </span>
  );
}
