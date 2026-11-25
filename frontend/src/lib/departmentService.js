
import { supabase } from './supabaseClient'

// Fetch departments that are currently active.
export async function getActiveDepartments() {
  const { data, error } = await supabase
    .from('departments')
    .select('id, name, category, service_area')
    .eq('active', true)
    .order('name', { ascending: true })

  if (error) throw error
  return data ?? []
}

// Get the signed-in citizen and ensure their email is verified.
async function getVerifiedCitizen() {
  const { data, error } = await supabase.auth.getUser()

  if (error) throw error

  const user = data?.user

  if (!user) {
    throw new Error('Please sign in before continuing.')
  }

  if (!user.email_confirmed_at) {
    throw new Error('Please verify your email before applying.')
  }

  return user
}

// Submit a department application.
export async function submitDepartmentApplication({
  departmentId,
  officialEmail,
  contactName,
  notes,
}) {
  const user = await getVerifiedCitizen()

  if (!departmentId || !officialEmail?.trim() || !contactName?.trim()) {
    throw new Error('Please complete all required fields.')
  }

  const normalizedEmail = officialEmail.trim().toLowerCase()

  // Prevent another pending application by this user.
  const { data: existing, error: lookupError } = await supabase
    .from('department_applications')
    .select('id, status')
    .eq('applicant_id', user.id)
    .eq('status', 'pending')
    .limit(1)

  if (lookupError) throw lookupError

  if (existing?.length) {
    throw new Error('You already have a pending department application.')
  }

  const { data, error } = await supabase
    .from('department_applications')
    .insert({
      applicant_id: user.id,
      department_id: departmentId,
      official_email: normalizedEmail,
      contact_name: contactName.trim(),
      notes: notes?.trim() || null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Fetch the signed-in citizen's own applications.
export async function getMyDepartmentApplications() {
  const user = await getVerifiedCitizen()

  const { data, error } = await supabase
    .from('department_applications')
    .select(`
      id,
      official_email,
      contact_name,
      notes,
      status,
      created_at,
      departments (
        id,
        name,
        category,
        service_area
      )
    `)
    .eq('applicant_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}
