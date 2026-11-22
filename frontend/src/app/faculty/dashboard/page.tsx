
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';

import {
  BookOpen,
  GraduationCap,
  Building2,
  UserRound,
  LogOut,
  RefreshCw,
  FileText,
  Microscope,
  LayoutDashboard,
  AlertCircle,
  ExternalLink,
  CalendarDays,
  BriefcaseBusiness,
  Pencil,
  Save,
  X,
  Link as LinkIcon,
  Image as ImageIcon,
  CheckCircle2,
  Plus,
  Search,
  Filter,
  TrendingUp,
  Award,
  Globe,
  BookMarked,
  Clock,
  ArrowUpDown,
  ChartColumnIncreasing,
  Layers,
  Eye,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface FacultyPublication {
  publication_id?: string | null;
  title?: string;
  year?: string | number | null;
  doi?: string;
  url?: string;
  publication_type?: string;
  source?: string;
  is_scraped?: boolean;
}

interface FacultyProfile {
  faculty_id?: string;
  name?: string;
  honorific?: string;
  department?: string;
  campus?: string;
  designation?: string;
  photo_url?: string;
  profile_url?: string;
  research_areas?: string[];
  publications?: FacultyPublication[];
}

interface DashboardResponse {
  faculty?: FacultyProfile;
  error?: string;
  message?: string;
}

interface ProfileFormData {
  honorific: string;
  designation: string;
  researchAreas: string;
  photoUrl: string;
  profileUrl: string;
}

interface PublicationFormData {
  title: string;
  year: string;
  doi: string;
  url: string;
  publication_type: string;
}

type PublicationSort = 'newest' | 'oldest' | 'title-asc' | 'title-desc';
type PublicationFilter = 'all' | 'journal' | 'conference' | 'other';

// ============================================================
// CONFIGURATION
// ============================================================

const API_BASE_URL = 'http://localhost:5000';

const PUBLICATION_TYPES = [
  'Journal Article',
  'Conference Paper',
  'Book',
  'Book Chapter',
  'Review Article',
  'Preprint',
  'Thesis',
  'Other',
];

// ============================================================
// NORMALIZATION HELPERS
// ============================================================

function getInitials(name?: string) {
  if (!name?.trim()) return 'F';

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function normalizeResearchAreas(areas?: unknown): string[] {
  if (!Array.isArray(areas)) return [];

  const normalized = areas
    .filter((area): area is string => typeof area === 'string')
    .map((area) => area.trim())
    .filter(Boolean);

  return [...new Set(normalized)];
}

function normalizePublications(
  publications?: FacultyPublication[]
): FacultyPublication[] {
  if (!Array.isArray(publications)) return [];

  return publications
    .filter(
      (publication): publication is FacultyPublication =>
        Boolean(publication) &&
        typeof publication === 'object' &&
        typeof publication.title === 'string' &&
        publication.title.trim().length > 0
    )
    .map((publication) => ({
      ...publication,
      title: publication.title?.trim() || 'Untitled publication',
      doi: typeof publication.doi === 'string' ? publication.doi.trim() : '',
      url: typeof publication.url === 'string' ? publication.url.trim() : '',
      publication_type:
        typeof publication.publication_type === 'string'
          ? publication.publication_type.trim()
          : '',
      publication_id:
        typeof publication.publication_id === 'string'
          ? publication.publication_id
          : null,
    }));
}

function getHonorific(faculty?: FacultyProfile | null) {
  const explicitHonorific = faculty?.honorific?.trim();

  if (explicitHonorific) return explicitHonorific;

  const name = faculty?.name?.trim() || '';
  const prefixMatch = name.match(
    /^(Dr\.?|Prof\.?|Professor|Mr\.?|Mrs\.?|Ms\.?|Miss)\s+/i
  );

  return prefixMatch ? prefixMatch[1] : '';
}

function getCleanFacultyName(name?: string) {
  if (!name) return 'Faculty Member';

  return name
    .trim()
    .replace(
      /^(Dr\.?|Prof\.?|Professor|Mr\.?|Mrs\.?|Ms\.?|Miss)\s+/i,
      ''
    );
}

function getGreeting(faculty?: FacultyProfile | null) {
  return [getHonorific(faculty), getCleanFacultyName(faculty?.name)]
    .filter(Boolean)
    .join(' ');
}

function isValidOptionalUrl(value: string) {
  if (!value.trim()) return true;

  try {
    const parsed = new URL(value.trim());

    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseYearValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;

  const currentYear = new Date().getFullYear() + 1;

  if (typeof value === 'number') {
    if (
      Number.isInteger(value) &&
      value >= 1000 &&
      value <= currentYear
    ) {
      return value;
    }

    return null;
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const exact = trimmed.match(/^(\d{4})(?:\.0+)?$/);

  if (exact) {
    const year = Number(exact[1]);

    if (year >= 1000 && year <= currentYear) {
      return year;
    }
  }

  const embedded = trimmed.match(/\b(\d{4})\b/);

  if (embedded) {
    const year = Number(embedded[1]);

    if (year >= 1000 && year <= currentYear) {
      return year;
    }
  }

  return null;
}

function getPublicationYear(
  publication: FacultyPublication
): number | null {
  const explicitYear = parseYearValue(publication.year);

  if (explicitYear !== null) return explicitYear;

  return parseYearValue(publication.title);
}

function getPublicationType(publication: FacultyPublication) {
  return publication.publication_type?.trim() || 'Other';
}

function isJournalPublication(publication: FacultyPublication) {
  return /journal|article|review/i.test(getPublicationType(publication));
}

function isConferencePublication(publication: FacultyPublication) {
  return /conference|proceeding|symposium|workshop/i.test(
    getPublicationType(publication)
  );
}

function getTypeCategory(publication: FacultyPublication) {
  if (isJournalPublication(publication)) return 'journal';
  if (isConferencePublication(publication)) return 'conference';
  return 'other';
}

function isImportedPublication(publication: FacultyPublication) {
  return (
    publication.is_scraped === true ||
    /openalex|scrap|import|harvest/i.test(publication.source || '') ||
    publication.source === 'scraped'
  );
}

function getPublicationLink(publication: FacultyPublication) {
  const rawUrl = publication.url?.trim();

  if (rawUrl && isValidOptionalUrl(rawUrl)) {
    return rawUrl;
  }

  const rawDoi = publication.doi?.trim();

  if (!rawDoi) return '';

  let doi = rawDoi
    .replace(/^doi:\s*/i, '')
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .trim();

  if (!doi) return '';

  if (/^https?:\/\//i.test(doi)) return '';

  return `https://doi.org/${doi}`;
}

function hasPublicationDoi(publication: FacultyPublication) {
  return Boolean(publication.doi?.trim());
}

function emptyPublicationForm(): PublicationFormData {
  return {
    title: '',
    year: '',
    doi: '',
    url: '',
    publication_type: 'Journal Article',
  };
}

function getPublicationFormYear(publication: FacultyPublication) {
  const year = getPublicationYear(publication);
  return year === null ? '' : String(year);
}

// ============================================================
// SMALL REUSABLE COMPONENTS
// ============================================================

function StatCard({
  label,
  value,
  description,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  description: string;
  icon: typeof BookOpen;
  color: 'indigo' | 'violet' | 'blue' | 'emerald';
}) {
  const colorClasses = {
    indigo: 'bg-indigo-50 text-indigo-600',
    violet: 'bg-violet-50 text-violet-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colorClasses[color]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof BookOpen;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
      <Icon className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-3 text-sm font-semibold text-slate-600">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-400">
        {description}
      </p>
    </div>
  );
}

// ============================================================
// MAIN DASHBOARD
// ============================================================

export default function FacultyDashboardPage() {
  const router = useRouter();

  const [faculty, setFaculty] = useState<FacultyProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  const [formData, setFormData] = useState<ProfileFormData>({
    honorific: '',
    designation: '',
    researchAreas: '',
    photoUrl: '',
    profileUrl: '',
  });

  const [publicationSearch, setPublicationSearch] = useState('');
  const [publicationFilter, setPublicationFilter] =
    useState<PublicationFilter>('all');
  const [publicationSort, setPublicationSort] =
    useState<PublicationSort>('newest');

  const [showPublicationForm, setShowPublicationForm] = useState(false);
  const [editingPublicationId, setEditingPublicationId] =
    useState<string | null>(null);

  const [publicationForm, setPublicationForm] =
    useState<PublicationFormData>(emptyPublicationForm());

  const [savingPublication, setSavingPublication] = useState(false);
  const [publicationError, setPublicationError] = useState('');

  const [selectedPublication, setSelectedPublication] =
    useState<FacultyPublication | null>(null);

  // ==========================================================
  // PROFILE FORM
  // ==========================================================

  const populateProfileForm = useCallback((profile: FacultyProfile) => {
    setFormData({
      honorific: getHonorific(profile),
      designation: profile.designation || '',
      researchAreas: normalizeResearchAreas(
        profile.research_areas
      ).join(', '),
      photoUrl: profile.photo_url || '',
      profileUrl: profile.profile_url || '',
    });
  }, []);

  // ==========================================================
  // FETCH DASHBOARD
  // ==========================================================

  const fetchDashboard = useCallback(
    async (isRefresh = false): Promise<boolean> => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const response = await fetch(
          `${API_BASE_URL}/faculty/dashboard`,
          {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            cache: 'no-store',
          }
        );

        const result: DashboardResponse = await response
          .json()
          .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            result.error ||
              result.message ||
              `Unable to load dashboard. Server returned status ${response.status}.`
          );
        }

        if (!result.faculty) {
          throw new Error(
            'Faculty profile information was not returned by the server.'
          );
        }

        setFaculty(result.faculty);
        populateProfileForm(result.faculty);

        return true;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Something went wrong while loading the dashboard.'
        );

        return false;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [populateProfileForm]
  );

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  // ==========================================================
  // PROFILE MANAGEMENT
  // ==========================================================

  const handleFormChange = (
    field: keyof ProfileFormData,
    value: string
  ) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));

    setProfileError('');
    setSuccessMessage('');
  };

  const handleEditProfile = () => {
    if (faculty) populateProfileForm(faculty);

    setProfileError('');
    setSuccessMessage('');
    setEditingProfile(true);
  };

  const handleCancelEdit = () => {
    if (faculty) populateProfileForm(faculty);

    setProfileError('');
    setEditingProfile(false);
  };

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setProfileError('');
    setSuccessMessage('');

    if (!formData.designation.trim()) {
      setProfileError('Please enter your designation.');
      return;
    }

    if (
      !isValidOptionalUrl(formData.photoUrl) ||
      !isValidOptionalUrl(formData.profileUrl)
    ) {
      setProfileError(
        'Please enter valid URLs beginning with http:// or https://.'
      );
      return;
    }

    const researchAreas = [
      ...new Set(
        formData.researchAreas
          .split(',')
          .map((area) => area.trim())
          .filter(Boolean)
      ),
    ];

    const payload = {
      honorific: formData.honorific.trim(),
      designation: formData.designation.trim(),
      research_areas: researchAreas,
      photo_url: formData.photoUrl.trim(),
      profile_url: formData.profileUrl.trim(),
    };

    setSavingProfile(true);

    try {
      const response = await fetch(`${API_BASE_URL}/faculty/profile`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error ||
            result.message ||
            `Unable to save profile. Server returned status ${response.status}.`
        );
      }

      if (result.faculty) {
        setFaculty(result.faculty);
        populateProfileForm(result.faculty);
      } else {
        const refreshed = await fetchDashboard(true);

        if (!refreshed) {
          throw new Error(
            'Profile was saved, but the updated dashboard could not be loaded. Please refresh the page.'
          );
        }
      }

      setEditingProfile(false);
      setSuccessMessage(
        result.message ||
          'Your research profile has been updated successfully.'
      );
    } catch (err) {
      setProfileError(
        err instanceof Error
          ? err.message
          : 'Unable to update your research profile.'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  // ==========================================================
  // PUBLICATION MANAGEMENT
  // ==========================================================

  const openAddPublication = () => {
    setEditingPublicationId(null);
    setPublicationForm(emptyPublicationForm());
    setPublicationError('');
    setShowPublicationForm(true);
    setSelectedPublication(null);
    setSuccessMessage('');
  };

  const openEditPublication = (publication: FacultyPublication) => {
    const publicationId = publication.publication_id?.trim();

    if (!publicationId) {
      setPublicationError(
        'This imported publication does not have a publication ID. The dashboard API must return a stable publication_id for this record before it can be edited.'
      );
      setSelectedPublication(null);
      return;
    }

    setEditingPublicationId(publicationId);

    setPublicationForm({
      title: publication.title || '',
      year: getPublicationFormYear(publication),
      doi: publication.doi || '',
      url: publication.url || '',
      publication_type: PUBLICATION_TYPES.includes(
        getPublicationType(publication)
      )
        ? getPublicationType(publication)
        : 'Other',
    });

    setPublicationError('');
    setShowPublicationForm(true);
    setSelectedPublication(null);
    setSuccessMessage('');
  };

  const closePublicationForm = () => {
    if (savingPublication) return;

    setShowPublicationForm(false);
    setEditingPublicationId(null);
    setPublicationForm(emptyPublicationForm());
    setPublicationError('');
  };

  const handlePublicationFormChange = (
    field: keyof PublicationFormData,
    value: string
  ) => {
    setPublicationForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setPublicationError('');
  };

  const handleSavePublication = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setPublicationError('');

    const title = publicationForm.title.trim();
    const year = publicationForm.year.trim();
    const doi = publicationForm.doi.trim();
    const url = publicationForm.url.trim();
    const publicationType = publicationForm.publication_type.trim();

    if (!title) {
      setPublicationError('Publication title is required.');
      return;
    }

    if (title.length > 500) {
      setPublicationError(
        'Publication title cannot exceed 500 characters.'
      );
      return;
    }

    if (year) {
      const parsedYear = Number(year);

      if (
        !Number.isInteger(parsedYear) ||
        parsedYear < 1000 ||
        parsedYear > new Date().getFullYear() + 1
      ) {
        setPublicationError('Please enter a valid publication year.');
        return;
      }
    }

    if (!isValidOptionalUrl(url)) {
      setPublicationError(
        'Please enter a valid publication URL beginning with http:// or https://.'
      );
      return;
    }

    if (doi.length > 300) {
      setPublicationError('DOI cannot exceed 300 characters.');
      return;
    }

    if (url.length > 2048) {
      setPublicationError('Publication URL is too long.');
      return;
    }

    if (!PUBLICATION_TYPES.includes(publicationType)) {
      setPublicationError('Please select a valid publication type.');
      return;
    }

    const payload = {
      title,
      year: year ? Number(year) : null,
      doi,
      url,
      publication_type: publicationType || 'Other',
    };

    setSavingPublication(true);

    try {
      const isEditing = Boolean(editingPublicationId);

      const endpoint = isEditing
        ? `${API_BASE_URL}/faculty/publications/${encodeURIComponent(
            editingPublicationId as string
          )}`
        : `${API_BASE_URL}/faculty/publications`;

      const response = await fetch(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error ||
            result.message ||
            `Unable to save publication. Server returned status ${response.status}.`
        );
      }

      const refreshed = await fetchDashboard(true);

      if (!refreshed) {
        throw new Error(
          'The publication was saved, but the dashboard could not be refreshed. Please refresh the page to verify the updated record.'
        );
      }

      setShowPublicationForm(false);
      setEditingPublicationId(null);
      setPublicationForm(emptyPublicationForm());

      setSuccessMessage(
        result.message ||
          (isEditing
            ? 'Publication updated successfully.'
            : 'Publication added successfully.')
      );
    } catch (err) {
      setPublicationError(
        err instanceof Error
          ? err.message
          : 'Unable to save publication.'
      );
    } finally {
      setSavingPublication(false);
    }
  };

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout = async () => {
    setLoggingOut(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/faculty/logout`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));

        throw new Error(
          result.error || 'Unable to log out. Please try again.'
        );
      }

      router.replace('/');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Logout failed. Please try again.'
      );

      setLoggingOut(false);
    }
  };

  // ==========================================================
  // DERIVED DATA
  // ==========================================================

  const researchAreas = useMemo(
    () => normalizeResearchAreas(faculty?.research_areas),
    [faculty?.research_areas]
  );

  const publications = useMemo(
    () => normalizePublications(faculty?.publications),
    [faculty?.publications]
  );

  const greetingName = getGreeting(faculty);

  const publicationYears = useMemo(() => {
    const counts: Record<number, number> = {};

    publications.forEach((publication) => {
      const year = getPublicationYear(publication);

      if (year !== null) {
        counts[year] = (counts[year] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([year, count]) => ({
        year: Number(year),
        count,
      }))
      .sort((a, b) => a.year - b.year);
  }, [publications]);

  const validPublicationYears = useMemo(
    () =>
      publications
        .map(getPublicationYear)
        .filter((year): year is number => year !== null),
    [publications]
  );

  const earliestYear =
    validPublicationYears.length > 0
      ? Math.min(...validPublicationYears)
      : null;

  const latestYear =
    validPublicationYears.length > 0
      ? Math.max(...validPublicationYears)
      : null;

  const publicationsWithKnownYears = validPublicationYears.length;

  const averagePublicationsPerYear =
    publicationYears.length > 0
      ? (
          publicationsWithKnownYears / publicationYears.length
        ).toFixed(1)
      : '0';

  const journalCount = publications.filter(
    isJournalPublication
  ).length;

  const conferenceCount = publications.filter(
    isConferencePublication
  ).length;

  const otherPublicationCount =
    publications.length - journalCount - conferenceCount;

  const importedPublicationCount = publications.filter(
    isImportedPublication
  ).length;

  const manuallyAddedCount =
    publications.length - importedPublicationCount;

  const maxYearlyCount = Math.max(
    1,
    ...publicationYears.map((item) => item.count)
  );

  const publicationTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    publications.forEach((publication) => {
      const type = getPublicationType(publication);
      counts[type] = (counts[type] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [publications]);

  const filteredPublications = useMemo(() => {
    const search = publicationSearch.trim().toLowerCase();

    let result = [...publications];

    if (search) {
      result = result.filter((publication) => {
        const year = getPublicationYear(publication);

        return [
          publication.title,
          publication.doi,
          publication.publication_type,
          publication.year,
          year,
        ]
          .filter((value) => value !== null && value !== undefined)
          .some((value) => String(value).toLowerCase().includes(search));
      });
    }

    if (publicationFilter !== 'all') {
      result = result.filter(
        (publication) =>
          getTypeCategory(publication) === publicationFilter
      );
    }

    result.sort((a, b) => {
      if (publicationSort === 'title-asc') {
        return (a.title || '').localeCompare(b.title || '');
      }

      if (publicationSort === 'title-desc') {
        return (b.title || '').localeCompare(a.title || '');
      }

      const yearA = getPublicationYear(a) ?? 0;
      const yearB = getPublicationYear(b) ?? 0;

      return publicationSort === 'newest'
        ? yearB - yearA
        : yearA - yearB;
    });

    return result;
  }, [
    publications,
    publicationSearch,
    publicationFilter,
    publicationSort,
  ]);

  const recentPublications = useMemo(
    () =>
      [...publications]
        .sort(
          (a, b) =>
            (getPublicationYear(b) ?? 0) -
            (getPublicationYear(a) ?? 0)
        )
        .slice(0, 5),
    [publications]
  );

  // ==========================================================
  // LOADING STATE
  // ==========================================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
          </div>

          <h2 className="mt-5 text-lg font-semibold text-slate-900">
            Loading your dashboard
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Retrieving your faculty profile and research information...
          </p>
        </div>
      </main>
    );
  }

  // ==========================================================
  // ERROR STATE
  // ==========================================================

  if (error && !faculty) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle className="h-7 w-7" />
          </div>

          <h1 className="mt-5 text-xl font-bold text-slate-900">
            Unable to load dashboard
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">{error}</p>

          <div className="mt-7 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void fetchDashboard()}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>

            <button
              type="button"
              onClick={() => router.replace('/')}
              className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Return to Home
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================================
  // DASHBOARD
  // ==========================================================

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-900">
      {/* TOP NAVIGATION */}

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-sm">
              <span className="text-sm font-bold text-white">RP</span>
            </div>

            <div>
              <p className="text-sm font-bold tracking-tight text-slate-900">
                RESEARCHPILOT
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400">
                Faculty Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 sm:flex">
              <BriefcaseBusiness className="h-4 w-4" />
              Faculty Account
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
            >
              {loggingOut ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              <span>{loggingOut ? 'Logging out...' : 'Log Out'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}

      <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
        {/* PAGE HEADING */}

        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
              <LayoutDashboard className="h-4 w-4" />
              Faculty Dashboard
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Welcome back{greetingName ? `, ${greetingName}` : ''}
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Manage your academic profile, publications, and research
              performance from one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void fetchDashboard(true)}
            disabled={refreshing}
            className="flex h-11 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-60 sm:self-auto"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>

        {/* GENERAL ERROR */}

        {error && faculty && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* SUCCESS MESSAGE */}

        {successMessage && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p>{successMessage}</p>
          </div>
        )}

        {/* FACULTY PROFILE CARD */}

        <section className="mt-9 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="h-2 bg-gradient-to-r from-indigo-500 via-blue-500 to-violet-500" />

          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-indigo-100 bg-indigo-50 text-3xl font-bold text-indigo-600">
              {faculty?.photo_url &&
              isValidOptionalUrl(faculty.photo_url) ? (
                <img
                  src={faculty.photo_url}
                  alt={faculty.name || 'Faculty profile'}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(faculty?.name)
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  {getGreeting(faculty)}
                </h2>

                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  Faculty
                </span>
              </div>

              <p className="mt-2 text-sm font-medium text-indigo-600">
                {faculty?.designation || 'Faculty Member'}
              </p>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                {faculty?.faculty_id && (
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-slate-400" />
                    Faculty ID: {faculty.faculty_id}
                  </div>
                )}

                {faculty?.department && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    {faculty.department}
                  </div>
                )}

                {faculty?.campus && (
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-slate-400" />
                    {faculty.campus}
                  </div>
                )}
              </div>

              {faculty?.profile_url &&
                isValidOptionalUrl(faculty.profile_url) && (
                  <a
                    href={faculty.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Institutional profile
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
            </div>
          </div>
        </section>

        {/* RESEARCH ANALYTICS DASHBOARD */}

        <section className="mt-10">
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-indigo-600">
                <ChartColumnIncreasing className="h-4 w-4" />
                Performance Overview
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                Research Analytics
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                An overview of your publications and research profile.
              </p>
            </div>

            <span className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 sm:self-auto">
              <Clock className="h-3.5 w-3.5" />
              Based on available profile data
            </span>
          </div>

          {/* SUMMARY CARDS */}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Publications"
              value={publications.length}
              description="Linked academic publications"
              icon={BookOpen}
              color="indigo"
            />

            <StatCard
              label="Research Areas"
              value={researchAreas.length}
              description="Areas in your research profile"
              icon={Microscope}
              color="violet"
            />

            <StatCard
              label="Journal Articles"
              value={journalCount}
              description="Journal and article publications"
              icon={BookMarked}
              color="blue"
            />

            <StatCard
              label="Conference Papers"
              value={conferenceCount}
              description="Conference-related publications"
              icon={Award}
              color="emerald"
            />
          </div>

          {/* ANALYTICS CHARTS */}

          <div className="mt-5 grid gap-5 xl:grid-cols-5">
            {/* PUBLICATIONS BY YEAR */}

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Publications by Year
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Number of publications recorded for each year
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
                  <TrendingUp className="h-4 w-4" />
                  Yearly trend
                </div>
              </div>

              {publicationYears.length > 0 ? (
                <div className="mt-8">
                  <div className="flex h-56 items-end gap-2 overflow-x-auto pb-2 sm:gap-4">
                    {publicationYears.map((item) => (
                      <div
                        key={item.year}
                        className="flex min-w-[34px] flex-1 flex-col items-center justify-end gap-2"
                      >
                        <span className="text-xs font-semibold text-slate-600">
                          {item.count}
                        </span>

                        <div
                          className="w-full max-w-14 rounded-t-lg bg-gradient-to-t from-indigo-600 to-violet-400 transition-all duration-500 hover:from-indigo-700 hover:to-violet-500"
                          style={{
                            height: `${Math.max(
                              8,
                              (item.count / maxYearlyCount) * 150
                            )}px`,
                          }}
                          title={`${item.count} publication(s) in ${item.year}`}
                        />

                        <span className="text-[10px] font-medium text-slate-400">
                          {item.year}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-400">
                    <span>
                      {earliestYear} – {latestYear}
                    </span>
                    <span>
                      {publicationsWithKnownYears} publication(s) with a
                      recognized year
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-6">
                  <EmptyState
                    icon={ChartColumnIncreasing}
                    title="No publication timeline available"
                    description="A timeline will appear when a publication has a valid year in its year field or a recognizable four-digit year in its title."
                  />
                </div>
              )}
            </div>

            {/* PUBLICATION TYPE DISTRIBUTION */}

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
              <h3 className="text-base font-bold text-slate-900">
                Publication Types
              </h3>

              <p className="mt-1 text-xs text-slate-400">
                Distribution by publication category
              </p>

              {publications.length > 0 ? (
                <div className="mt-7">
                  <div className="space-y-5">
                    {[
                      {
                        label: 'Journal Articles',
                        count: journalCount,
                        color: 'bg-indigo-500',
                      },
                      {
                        label: 'Conference Papers',
                        count: conferenceCount,
                        color: 'bg-violet-500',
                      },
                      {
                        label: 'Other Publications',
                        count: otherPublicationCount,
                        color: 'bg-blue-400',
                      },
                    ].map((item) => {
                      const percentage = Math.round(
                        (item.count / publications.length) * 100
                      );

                      return (
                        <div key={item.label}>
                          <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium text-slate-600">
                              {item.label}
                            </span>
                            <span className="font-semibold text-slate-900">
                              {item.count} ({percentage}%)
                            </span>
                          </div>

                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${item.color} transition-all duration-500`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-7 rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">
                      Average publications per recorded publication year
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {averagePublicationsPerYear}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Based only on publications with a recognized year.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-6">
                  <EmptyState
                    icon={Layers}
                    title="No publication data"
                    description="Publication-type statistics will be available once publications are associated with your profile."
                  />
                </div>
              )}
            </div>
          </div>

          {/* RESEARCH PROFILE ANALYTICS */}

          <div className="mt-5 grid items-stretch gap-5 lg:grid-cols-2">
            {/* RESEARCH AREA OVERVIEW */}

            <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Microscope className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900">
                    Research Area Overview
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Areas listed in your faculty profile
                  </p>
                </div>
              </div>

              {researchAreas.length > 0 ? (
                <div className="mt-5 flex flex-1 flex-wrap content-start gap-2.5">
                  {researchAreas.map((area, index) => (
                    <div
                      key={`${area}-${index}`}
                      className="inline-flex max-w-full items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2.5"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-[11px] font-bold text-indigo-600 shadow-sm">
                        {index + 1}
                      </span>

                      <p className="break-words text-xs font-semibold leading-5 text-indigo-800">
                        {area}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5">
                  <EmptyState
                    icon={Microscope}
                    title="No research areas"
                    description="Add research areas to your profile to display your research specializations here."
                  />
                </div>
              )}
            </div>

            {/* PUBLICATION RECORD OVERVIEW */}

            <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <Globe className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900">
                    Publication Record Overview
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Summary of your publication records
                  </p>
                </div>
              </div>

              <div className="mt-5 grid flex-1 content-start gap-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Earliest publication year
                    </p>
                    <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                      {earliestYear ?? 'N/A'}
                    </p>
                  </div>

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Most recent publication year
                    </p>
                    <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                      {latestYear ?? 'N/A'}
                    </p>
                  </div>

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RECENT PUBLICATIONS */}

          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Recent Publications
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Your latest recorded academic publications
                </p>
              </div>

              <span className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
                {recentPublications.length} recent records
              </span>
            </div>

            {recentPublications.length > 0 ? (
              <div className="mt-5 divide-y divide-slate-100">
                {recentPublications.map((publication, index) => {
                  const year = getPublicationYear(publication);
                  const link = getPublicationLink(publication);

                  return (
                    <div
                      key={
                        publication.publication_id ||
                        `${publication.title}-${index}`
                      }
                      className="flex flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                          <FileText className="h-4 w-4" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-6 text-slate-800">
                            {publication.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {year ?? 'Year not specified'}
                            {' · '}
                            {getPublicationType(publication)}
                          </p>
                        </div>
                      </div>

                      {link && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          View publication
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5">
                <EmptyState
                  icon={BookOpen}
                  title="No recent publications"
                  description="Your recent publication records will appear here."
                />
              </div>
            )}
          </div>
        </section>

        {/* RESEARCH PROFILE MANAGEMENT */}

        <section className="mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <UserRound className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Research Profile Management
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Manage your personal and institutional research information
                </p>
              </div>
            </div>

            {!editingProfile && (
              <button
                type="button"
                onClick={handleEditProfile}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                <Pencil className="h-4 w-4" />
                Edit Profile
              </button>
            )}
          </div>

          {profileError && (
            <div className="mx-6 mt-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:mx-8">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {profileError}
            </div>
          )}

          {editingProfile ? (
            <form
              onSubmit={handleSaveProfile}
              className="space-y-6 p-6 sm:p-8"
            >
              <div className="grid gap-2">
                <label
                  htmlFor="honorific"
                  className="text-sm font-semibold text-slate-700"
                >
                  Title / Honorific
                </label>

                <select
                  id="honorific"
                  value={formData.honorific}
                  onChange={(event) =>
                    handleFormChange('honorific', event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">No title</option>
                  <option value="Dr.">Dr.</option>
                  <option value="Prof.">Prof.</option>
                  <option value="Mr.">Mr.</option>
                  <option value="Mrs.">Mrs.</option>
                  <option value="Ms.">Ms.</option>
                  <option value="Miss">Miss</option>
                </select>
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="designation"
                  className="text-sm font-semibold text-slate-700"
                >
                  Designation
                </label>

                <input
                  id="designation"
                  type="text"
                  value={formData.designation}
                  onChange={(event) =>
                    handleFormChange('designation', event.target.value)
                  }
                  placeholder="e.g. Associate Professor"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  required
                />
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="researchAreas"
                  className="text-sm font-semibold text-slate-700"
                >
                  Research Areas
                </label>

                <textarea
                  id="researchAreas"
                  value={formData.researchAreas}
                  onChange={(event) =>
                    handleFormChange('researchAreas', event.target.value)
                  }
                  rows={4}
                  placeholder="Machine Learning, Data Science, Cybersecurity"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />

                <p className="text-xs text-slate-400">
                  Separate multiple research areas using commas.
                </p>
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="photoUrl"
                  className="flex items-center gap-2 text-sm font-semibold text-slate-700"
                >
                  <ImageIcon className="h-4 w-4 text-slate-400" />
                  Profile Photo URL
                </label>

                <input
                  id="photoUrl"
                  type="url"
                  value={formData.photoUrl}
                  onChange={(event) =>
                    handleFormChange('photoUrl', event.target.value)
                  }
                  placeholder="https://example.com/profile-photo.jpg"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="profileUrl"
                  className="flex items-center gap-2 text-sm font-semibold text-slate-700"
                >
                  <LinkIcon className="h-4 w-4 text-slate-400" />
                  Institutional Profile URL
                </label>

                <input
                  id="profileUrl"
                  type="url"
                  value={formData.profileUrl}
                  onChange={(event) =>
                    handleFormChange('profileUrl', event.target.value)
                  }
                  placeholder="https://university.edu/faculty/your-profile"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={savingProfile}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {savingProfile ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {savingProfile ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Title
                </p>
                <p className="mt-2 text-sm font-medium text-slate-800">
                  {getHonorific(faculty) || 'Not specified'}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Designation
                </p>
                <p className="mt-2 text-sm font-medium text-slate-800">
                  {faculty?.designation || 'Not specified'}
                </p>
              </div>

              <div className="sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Research Areas
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {researchAreas.length > 0 ? (
                    researchAreas.map((area, index) => (
                      <span
                        key={`${area}-${index}`}
                        className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700"
                      >
                        {area}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-400">
                      No research areas added.
                    </span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Profile Photo
                </p>

                {faculty?.photo_url &&
                isValidOptionalUrl(faculty.photo_url) ? (
                  <a
                    href={faculty.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    View profile photo
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">
                    No photo URL provided.
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Institutional Profile
                </p>

                {faculty?.profile_url &&
                isValidOptionalUrl(faculty.profile_url) ? (
                  <a
                    href={faculty.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Open profile link
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">
                    No institutional profile link provided.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* PUBLICATION MANAGEMENT */}

        <section className="mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <BookOpen className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Publication Management
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  View, add, search, and edit your academic publications
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={openAddPublication}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Add Publication
            </button>
          </div>

          {/* PUBLICATION FORM */}

          {showPublicationForm && (
            <div className="border-b border-indigo-100 bg-indigo-50/40 p-6 sm:p-8">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingPublicationId
                      ? 'Edit Publication'
                      : 'Add New Publication'}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Enter the publication details below.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closePublicationForm}
                  disabled={savingPublication}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-700"
                  aria-label="Close publication form"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {publicationError && (
                <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  {publicationError}
                </div>
              )}

              <form onSubmit={handleSavePublication} className="space-y-5">
                <div className="grid gap-2">
                  <label
                    htmlFor="publicationTitle"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Publication Title *
                  </label>
                  <input
                    id="publicationTitle"
                    type="text"
                    required
                    maxLength={500}
                    value={publicationForm.title}
                    onChange={(event) =>
                      handlePublicationFormChange('title', event.target.value)
                    }
                    placeholder="Enter the full publication title"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label
                      htmlFor="publicationYear"
                      className="text-sm font-semibold text-slate-700"
                    >
                      Publication Year
                    </label>
                    <input
                      id="publicationYear"
                      type="number"
                      min="1000"
                      max={new Date().getFullYear() + 1}
                      value={publicationForm.year}
                      onChange={(event) =>
                        handlePublicationFormChange('year', event.target.value)
                      }
                      placeholder="e.g. 2025"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div className="grid gap-2">
                    <label
                      htmlFor="publicationType"
                      className="text-sm font-semibold text-slate-700"
                    >
                      Publication Type
                    </label>
                    <select
                      id="publicationType"
                      value={publicationForm.publication_type}
                      onChange={(event) =>
                        handlePublicationFormChange(
                          'publication_type',
                          event.target.value
                        )
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    >
                      {PUBLICATION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label
                      htmlFor="publicationDoi"
                      className="text-sm font-semibold text-slate-700"
                    >
                      DOI
                    </label>
                    <input
                      id="publicationDoi"
                      type="text"
                      maxLength={300}
                      value={publicationForm.doi}
                      onChange={(event) =>
                        handlePublicationFormChange('doi', event.target.value)
                      }
                      placeholder="e.g. 10.1000/xyz123"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div className="grid gap-2">
                    <label
                      htmlFor="publicationUrl"
                      className="text-sm font-semibold text-slate-700"
                    >
                      Publication URL
                    </label>
                    <input
                      id="publicationUrl"
                      type="url"
                      value={publicationForm.url}
                      onChange={(event) =>
                        handlePublicationFormChange('url', event.target.value)
                      }
                      placeholder="https://example.com/publication"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-indigo-100 pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closePublicationForm}
                    disabled={savingPublication}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={savingPublication}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingPublication ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {savingPublication
                      ? 'Saving...'
                      : editingPublicationId
                        ? 'Save Publication'
                        : 'Add Publication'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* PUBLICATION SUMMARY */}

          <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-5 sm:grid-cols-3 sm:p-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-400">Total publications</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {publications.length}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-400">Imported records</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {importedPublicationCount}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-400">Other records</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {manuallyAddedCount}
              </p>
            </div>
          </div>

          {/* SEARCH AND FILTERS */}

          <div className="space-y-4 p-6 sm:p-8">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={publicationSearch}
                  onChange={(event) =>
                    setPublicationSearch(event.target.value)
                  }
                  placeholder="Search by title, DOI, year, or publication type..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={publicationFilter}
                    onChange={(event) =>
                      setPublicationFilter(
                        event.target.value as PublicationFilter
                      )
                    }
                    className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-8 text-sm outline-none focus:border-indigo-400 sm:w-48"
                  >
                    <option value="all">All types</option>
                    <option value="journal">Journal articles</option>
                    <option value="conference">Conference papers</option>
                    <option value="other">Other publications</option>
                  </select>
                </div>

                <div className="relative">
                  <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={publicationSort}
                    onChange={(event) =>
                      setPublicationSort(
                        event.target.value as PublicationSort
                      )
                    }
                    className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-8 text-sm outline-none focus:border-indigo-400 sm:w-48"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="title-asc">Title A–Z</option>
                    <option value="title-desc">Title Z–A</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Showing{' '}
                <span className="font-semibold text-slate-800">
                  {filteredPublications.length}
                </span>{' '}
                of {publications.length} publications
              </p>

              {(publicationSearch || publicationFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setPublicationSearch('');
                    setPublicationFilter('all');
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* PUBLICATION LIST */}

            {filteredPublications.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {filteredPublications.map((publication, index) => {
                  const publicationLink = getPublicationLink(publication);
                  const imported = isImportedPublication(publication);
                  const publicationYear = getPublicationYear(publication);

                  return (
                    <article
                      key={
                        publication.publication_id ||
                        `${publication.title}-${index}`
                      }
                      className="flex flex-col gap-4 py-5 first:pt-2 last:pb-2 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="flex min-w-0 gap-3">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                          <FileText className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold leading-6 text-slate-900">
                            {publication.title}
                          </h3>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {publicationYear !== null && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
                                <CalendarDays className="h-3 w-3" />
                                {publicationYear}
                              </span>
                            )}

                            <span className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-medium text-indigo-700">
                              {getPublicationType(publication)}
                            </span>

                            {imported ? (
                              <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
                                Imported record
                              </span>
                            ) : (
                              <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
                                Faculty record
                              </span>
                            )}
                          </div>

                          {publication.doi && (
                            <p className="mt-2 break-all text-xs text-slate-400">
                              DOI: {publication.doi}
                            </p>
                          )}

                          {publicationLink && (
                            <a
                              href={publicationLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                            >
                              View publication
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 sm:pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedPublication(publication)}
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditPublication(publication)}
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Search}
                title="No matching publications"
                description="Try changing your search or filters, or add a new publication to your profile."
              />
            )}
          </div>

          {/* PUBLICATION POLICY */}

          <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:px-8">
            <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p>
                Publications can be added and edited by the authenticated
                faculty member. Deletion is not available in this dashboard,
                protecting imported and institutional publication records.
              </p>
            </div>
          </div>
        </section>

        {/* PUBLICATION DETAIL MODAL */}

        {selectedPublication && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedPublication(null);
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="publication-detail-title"
              className="my-auto w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                      Publication Details
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Academic publication record
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPublication(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close publication details"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <h2
                id="publication-detail-title"
                className="mt-6 text-xl font-bold leading-7 text-slate-900"
              >
                {selectedPublication.title}
              </h2>

              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Publication Year
                  </p>
                  <p className="mt-1 text-sm text-slate-800">
                    {getPublicationYear(selectedPublication) ??
                      'Not specified'}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Publication Type
                  </p>
                  <p className="mt-1 text-sm text-slate-800">
                    {getPublicationType(selectedPublication)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    DOI
                  </p>
                  <p className="mt-1 break-all text-sm text-slate-800">
                    {selectedPublication.doi || 'Not provided'}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Publication URL
                  </p>
                  <p className="mt-1 break-all text-sm text-slate-800">
                    {selectedPublication.url || 'Not provided'}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Source
                  </p>
                  <p className="mt-1 text-sm text-slate-800">
                    {isImportedPublication(selectedPublication)
                      ? 'Imported / scraped record'
                      : 'Faculty publication record'}
                  </p>
                </div>

                {getPublicationLink(selectedPublication) && (
                  <a
                    href={getPublicationLink(selectedPublication)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    Open publication
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>

              <div className="mt-7 flex justify-end border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => openEditPublication(selectedPublication)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Publication
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}

        <footer className="mt-12 border-t border-slate-200 py-7">
          <div className="flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
            <div>
              <p className="text-xs font-bold tracking-tight text-slate-700">
                RESEARCHPILOT
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                Faculty Research Portal
              </p>
            </div>

            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400">
              RESEARCHPILOT // 2026
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
