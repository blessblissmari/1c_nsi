import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, Link } from 'react-router'
import toast from 'react-hot-toast'
import { authApi } from '../api'
import { useAuthStore } from './store'

interface FormValues {
  email: string
  password: string
  full_name: string
}

export function RegisterPage() {
  const navigate = useNavigate()
  const setToken = useAuthStore((s) => s.setToken)
  const setUser = useAuthStore((s) => s.setUser)
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>()

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    try {
      await authApi.register(values.email, values.password, values.full_name)
      const { access_token } = await authApi.login(values.email, values.password)
      setToken(access_token)
      const user = await authApi.me()
      setUser(user)
      toast.success('Регистрация успешна')
      navigate('/', { replace: true })
    } catch (e: unknown) {
      toast.error('Не удалось зарегистрироваться (email уже занят?)')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-graphite flex items-center justify-center px-4">
      <div className="w-full max-w-sm glass p-6 rounded-2xl border border-slate-300/30">
        <h1 className="text-xl font-semibold mb-1">Регистрация</h1>
        <p className="text-sm text-slate-400 mb-6">Создайте учётную запись</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Email</label>
            <input
              type="email"
              className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-neon"
              {...register('email', { required: 'Обязательное поле' })}
            />
            {errors.email && <div className="text-red-400 text-xs mt-1">{errors.email.message}</div>}
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">ФИО</label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-neon"
              {...register('full_name')}
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Пароль (не короче 8 символов)</label>
            <input
              type="password"
              className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-neon"
              {...register('password', { required: 'Обязательное поле', minLength: { value: 8, message: 'Не менее 8 символов' } })}
            />
            {errors.password && <div className="text-red-400 text-xs mt-1">{errors.password.message}</div>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 rounded-md bg-neon/90 hover:bg-neon text-white text-sm font-medium transition disabled:opacity-50"
          >
            {submitting ? 'Регистрируем...' : 'Создать аккаунт'}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-slate-400">
          Уже есть учётная запись? <Link to="/login" className="text-neon hover:underline">Войти</Link>
        </div>
      </div>
    </div>
  )
}
