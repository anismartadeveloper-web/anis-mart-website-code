import { z } from 'zod'

const today = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export const displayNameSchema = z.string().trim().min(2, 'Nama panggilan minimal 2 karakter.').max(30, 'Nama panggilan maksimal 30 karakter.')
export const usernameSchema = z.string().trim().regex(/^[a-z0-9._]{3,20}$/, 'Username harus 3–20 karakter: huruf kecil, angka, titik, atau garis bawah.')
export const birthDateSchema = z.string().nullable().refine((value) => {
  if (value === null) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today()) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}, 'Tanggal lahir tidak valid atau berada di masa depan.')

export const profileFormSchema = z.object({
  display_name: displayNameSchema,
  username: usernameSchema,
  birth_date: birthDateSchema,
})

export const passwordChangeSchema = z.object({
  current_password: z.string().min(1, 'Masukkan kata sandi saat ini.'),
  new_password: z.string().min(8, 'Kata sandi baru minimal 8 karakter.'),
  confirm_password: z.string().min(8, 'Konfirmasi kata sandi minimal 8 karakter.'),
}).superRefine((values, context) => {
  if (values.new_password === values.current_password) {
    context.addIssue({ code: 'custom', path: ['new_password'], message: 'Kata sandi baru harus berbeda dari yang lama.' })
  }
  if (values.confirm_password !== values.new_password) {
    context.addIssue({ code: 'custom', path: ['confirm_password'], message: 'Konfirmasi kata sandi baru belum sama.' })
  }
})

export const profilePatchSchema = z.object({
  display_name: displayNameSchema.optional(),
  username: usernameSchema.optional(),
  birth_date: birthDateSchema.optional(),
  avatar_url: z.string().url('Alamat foto tidak valid.').nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Tidak ada perubahan untuk disimpan.')

export type ProfileFormValues = z.infer<typeof profileFormSchema>
