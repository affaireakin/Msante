import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // IMPORTANT: supabaseResponse must be rebuilt in setAll to forward refreshed tokens
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const pathname = request.nextUrl.pathname

  if (pathname.startsWith('/admin')) {
    if (!profile || profile.role !== 'admin') {
      if (profile?.role === 'practitioner') return NextResponse.redirect(new URL('/practitioner', request.url))
      if (profile?.role === 'patient') return NextResponse.redirect(new URL('/patient', request.url))
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }

  if (pathname.startsWith('/practitioner')) {
    if (!profile || profile.role !== 'practitioner') {
      if (profile?.role === 'admin') return NextResponse.redirect(new URL('/admin/overview', request.url))
      if (profile?.role === 'patient') return NextResponse.redirect(new URL('/patient', request.url))
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }

  if (pathname.startsWith('/patient')) {
    if (!profile || profile.role !== 'patient') {
      if (profile?.role === 'admin') return NextResponse.redirect(new URL('/admin/overview', request.url))
      if (profile?.role === 'practitioner') return NextResponse.redirect(new URL('/practitioner', request.url))
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }

  // IMPORTANT: return supabaseResponse (not a new response) so refreshed cookies are forwarded
  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*', '/practitioner/:path*', '/patient/:path*'],
}
