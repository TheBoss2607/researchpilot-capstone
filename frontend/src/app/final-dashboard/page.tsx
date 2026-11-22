
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  Lightbulb,
  Loader2,
  Printer,
  Search,
  Target,
  Users,
  UserRound,
  LayoutDashboard,
  ExternalLink,
  CircleHelp,
} from 'lucide-react';

type AnyObject = Record<string, unknown>;

type DashboardData = {
  email: string;
  interests: unknown;
  goals: unknown;
  skills: unknown;
  mode: string;
  groupMembers: unknown[];
  papers: unknown[];
  gaps: unknown[];
  ideas: unknown[];
  selectedProject: AnyObject | null;
  faculty: unknown[];
  recommendationData: unknown;
  profileData: unknown;
  groupData: AnyObject | null;
};

const EMPTY_DATA: DashboardData = {
  email: '',
  interests: '',
  goals: '',
  skills: '',
  mode: '',
  groupMembers: [],
  papers: [],
  gaps: [],
  ideas: [],
  selectedProject: null,
  faculty: [],
  recommendationData: null,
  profileData: null,
  groupData: null,
};

const PROFILE_API_URL =
  process.env.NEXT_PUBLIC_PROFILE_API_URL ||
  'http://127.0.0.1:5000/get-profile';

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:5000'
).replace(/\/+$/, '');

const MAX_GAPS = 5;
const MAX_IDEAS = 5;

/* -------------------------------------------------------------------------- */
/* General helpers                                                            */
/* -------------------------------------------------------------------------- */

function parseJSON(value: string | null): unknown {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function asObject(value: unknown): AnyObject | null {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value as AnyObject;
  }

  return null;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;

  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed: unknown = JSON.parse(trimmed);

        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Fall through to normal text splitting.
      }
    }

    return trimmed
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function text(value: unknown): string {
  if (value === null || value === undefined) return '';

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    const trimmed = String(value).trim();

    if (
      trimmed.startsWith('[') &&
      trimmed.endsWith(']')
    ) {
      try {
        const parsed: unknown = JSON.parse(trimmed);

        if (Array.isArray(parsed)) {
          return parsed.map(text).filter(Boolean).join(', ');
        }
      } catch {
        // Keep original text.
      }
    }

    if (
      trimmed.startsWith('{') &&
      trimmed.endsWith('}')
    ) {
      try {
        const parsed: unknown = JSON.parse(trimmed);

        if (parsed && typeof parsed === 'object') {
          return text(parsed);
        }
      } catch {
        // Keep original text.
      }
    }

    return trimmed;
  }

  if (Array.isArray(value)) {
    return value.map(text).filter(Boolean).join(', ');
  }

  if (typeof value === 'object') {
    const obj = value as AnyObject;

    for (const key of [
      'description',
      'text',
      'name',
      'title',
      'value',
      'email',
    ]) {
      if (obj[key] !== undefined) {
        const result = text(obj[key]);
        if (result) return result;
      }
    }

    return Object.entries(obj)
      .filter(
        ([, itemValue]) =>
          itemValue !== null &&
          itemValue !== undefined &&
          itemValue !== '',
      )
      .map(
        ([key, itemValue]) =>
          `${displayFieldName(key)}: ${text(itemValue)}`,
      )
      .filter(Boolean)
      .join('\n');
  }

  return '';
}

function firstValue(
  sources: unknown[],
  keys: string[],
): unknown {
  for (const source of sources) {
    const obj = asObject(source);
    if (!obj) continue;

    for (const key of keys) {
      const value = obj[key];

      if (
        value !== undefined &&
        value !== null &&
        value !== ''
      ) {
        return value;
      }
    }
  }

  return '';
}

function renderValue(value: unknown): string {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 'Not available';
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return text(value) || 'Not available';
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => text(item))
      .filter(Boolean);

    return items.length > 0
      ? items.map((item) => `• ${item}`).join('\n')
      : 'Not available';
  }

  if (typeof value === 'object') {
    const obj = value as AnyObject;

    const entries = Object.entries(obj).filter(
      ([, itemValue]) =>
        itemValue !== null &&
        itemValue !== undefined &&
        itemValue !== '',
    );

    if (entries.length === 0) return 'Not available';

    return entries
      .map(
        ([key, itemValue]) =>
          `${displayFieldName(key)}: ${renderValue(itemValue)}`,
      )
      .join('\n');
  }

  return String(value);
}

/* Improved field labels: underscores removed and ID capitalized. */
function displayFieldName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bId\b/g, 'ID')
    .trim();
}

/* Convert generated identifiers into readable labels. */
function formatIdentifierValue(
  key: string,
  value: unknown,
): string {
  const original = text(value);
  if (!original) return '';

  const normalizedKey = key.toLowerCase();

  if (
    normalizedKey === 'idea_id' ||
    normalizedKey === 'project_idea_id'
  ) {
    const match = original.match(/^idea[_\s-]*(\d+)$/i);

    if (match) return `Idea ${match[1]}`;
  }

  if (
    normalizedKey === 'gap_id' ||
    normalizedKey === 'research_gap_id' ||
    normalizedKey === 'research_gap'
  ) {
    const match = original.match(
      /^(?:research[_\s-]*)?gap[_\s-]*(\d+)$/i,
    );

    if (match) return `Research Gap ${match[1]}`;
  }

  return original;
}

function getTitle(
  value: unknown,
  fallback: string,
): string {
  const obj = asObject(value);

  if (!obj) return text(value) || fallback;

  return (
    text(obj.title) ||
    text(obj.name) ||
    text(obj.project_title) ||
    text(obj.project_name) ||
    text(obj.idea_title) ||
    text(obj.paper_title) ||
    text(obj.gap_title) ||
    text(obj.project_idea) ||
    text(obj.research_gap) ||
    fallback
  );
}

function getPaperAuthors(paper: unknown): string {
  const obj = asObject(paper);
  if (!obj) return '';

  return text(
    obj.authors ??
      obj.author_names ??
      obj.author ??
      obj.authors_list,
  );
}

function getPaperUrl(paper: unknown): string {
  const obj = asObject(paper);

  return (
    text(obj?.url) ||
    text(obj?.doi_url) ||
    text(obj?.paper_url) ||
    text(obj?.link) ||
    text(obj?.openalex_url)
  );
}

function getFacultyName(member: unknown): string {
  const obj = asObject(member);

  if (!obj) return text(member) || 'Faculty member';

  return (
    text(obj.name) ||
    text(obj.faculty_name) ||
    text(obj.full_name) ||
    'Faculty member'
  );
}

/* Faculty profile-page URL. */
function getFacultyProfileUrl(member: unknown): string {
  const obj = asObject(member);
  if (!obj) return '';

  return (
    text(obj.faculty_profile_url) ||
    text(obj.profile_url) ||
    text(obj.faculty_page_url) ||
    text(obj.profile_page_url) ||
    text(obj.faculty_url) ||
    text(obj.personal_website) ||
    text(obj.homepage) ||
    text(obj.website) ||
    ''
  );
}

/* Extract the faculty ID used by the Flask photo endpoint. */
function getFacultyId(member: unknown): string {
  const obj = asObject(member);
  if (!obj) return '';

  const directId =
    text(obj.faculty_id) ||
    text(obj.id);

  if (/^nm\d+$/i.test(directId)) {
    return directId;
  }

  const profileUrl = getFacultyProfileUrl(member);
  const match = profileUrl.match(/\/(nm\d+)(?:\/|$)/i);

  return match?.[1] || '';
}

/* Collect possible photo URLs, trying the local Flask endpoint first. */
function getFacultyPhotoUrls(member: unknown): string[] {
  const obj = asObject(member);
  if (!obj) return [];

  const facultyId = getFacultyId(member);

  const candidates = [
    facultyId
      ? `${API_BASE_URL}/faculty-photos/${encodeURIComponent(facultyId)}`
      : '',
    text(obj.photo_url),
    text(obj.image_url),
    text(obj.profile_image),
    text(obj.photo),
    text(obj.photoUrl),
  ];

  return [...new Set(candidates.filter(Boolean))];
}

function getFacultyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return 'F';

  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function isSensitiveProfileField(key: string): boolean {
  return /password|passwd|password_hash|token|secret|salt|credential/i.test(
    key,
  );
}

function isHiddenRecommendedTechnologiesField(
  key: string,
  value: unknown,
): boolean {
  const normalizedKey = key
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();

  const isRecommendedTechnologies =
    normalizedKey === 'recommended_technologies' ||
    normalizedKey === 'recommended_technology' ||
    normalizedKey === 'recommended_tech';

  if (!isRecommendedTechnologies) return false;

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return true;
  }

  if (Array.isArray(value) && value.length === 0) {
    return true;
  }

  if (
    typeof value === 'string' &&
    ['[]', '{}', 'null', 'none', 'n/a'].includes(
      value.trim().toLowerCase(),
    )
  ) {
    return true;
  }

  return false;
}

function unwrapProfileResponse(value: unknown): unknown {
  const obj = asObject(value);
  if (!obj) return value;

  for (const key of ['profile', 'user', 'account', 'data']) {
    const nested = asObject(obj[key]);

    if (nested) return nested;
  }

  return value;
}

/* -------------------------------------------------------------------------- */
/* Section-specific data extraction                                           */
/* -------------------------------------------------------------------------- */

function findSectionArray(
  value: unknown,
  possibleKeys: string[],
  depth = 0,
): unknown[] {
  if (depth > 7 || value == null) return [];

  if (Array.isArray(value)) return value;

  const obj = asObject(value);
  if (!obj) return [];

  for (const key of possibleKeys) {
    const child = obj[key];

    if (Array.isArray(child)) return child;

    if (child && typeof child === 'object') {
      const nested = findSectionArray(
        child,
        possibleKeys,
        depth + 1,
      );

      if (nested.length > 0) return nested;
    }
  }

  for (const wrapper of [
    'data',
    'result',
    'response',
    'payload',
  ]) {
    const child = obj[wrapper];

    if (child && typeof child === 'object') {
      const nested = findSectionArray(
        child,
        possibleKeys,
        depth + 1,
      );

      if (nested.length > 0) return nested;
    }
  }

  return [];
}

function collectStoredValues(
  storage: Storage,
  keys: string[],
): unknown[] {
  const result: unknown[] = [];

  for (const key of keys) {
    const value = parseJSON(storage.getItem(key));

    if (value !== null && value !== '') {
      result.push(value);
    }
  }

  return result;
}

function collectMatchingStorage(
  storage: Storage,
  prefixes: string[],
): unknown[] {
  const result: unknown[] = [];

  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);

    if (
      !key ||
      !prefixes.some((prefix) => key.startsWith(prefix))
    ) {
      continue;
    }

    const value = parseJSON(storage.getItem(key));

    if (value !== null) result.push(value);
  }

  return result;
}

function isPaperRecord(value: unknown): boolean {
  const obj = asObject(value);
  if (!obj) return false;

  const keys = Object.keys(obj).map((key) =>
    key.toLowerCase(),
  );

  return (
    keys.some((key) =>
      [
        'doi',
        'doi_url',
        'openalex_id',
        'openalex_url',
        'work_id',
        'publication_year',
        'cited_by_count',
        'authorships',
      ].includes(key),
    ) ||
    keys.some((key) =>
      [
        'authors',
        'author_names',
        'authors_list',
        'author_names_list',
      ].includes(key),
    ) ||
    Boolean(obj.paper_title || obj.publication_title)
  );
}

function uniqueRecords(
  values: unknown[],
  type: 'paper' | 'gap' | 'idea' | 'faculty',
): unknown[] {
  const seen = new Set<string>();
  const output: unknown[] = [];

  for (const value of values) {
    if (
      (type === 'gap' || type === 'idea') &&
      isPaperRecord(value)
    ) {
      continue;
    }

    const obj = asObject(value);

    const id =
      text(obj?.idea_id) ||
      text(obj?.gap_id) ||
      text(obj?.paper_id) ||
      text(obj?.work_id) ||
      text(obj?.project_id) ||
      text(obj?.faculty_id) ||
      text(obj?.id);

    const title = getTitle(value, '');

    const signature = id
      ? `${type}:id:${id}`
      : title
        ? `${type}:title:${title.toLowerCase()}`
        : `${type}:value:${renderValue(value)}`;

    if (seen.has(signature)) continue;

    seen.add(signature);
    output.push(value);
  }

  return output;
}

function getProblemStatement(item: unknown): string {
  const obj = asObject(item);
  if (!obj) return '';

  return (
    text(obj.problem_statement) ||
    text(obj.problemStatement) ||
    text(obj.problem_statement_text) ||
    text(obj.problemStatementText) ||
    text(obj.research_problem) ||
    text(obj.problem)
  );
}

function getProjectDescription(item: unknown): string {
  const obj = asObject(item);
  if (!obj) return '';

  return (
    text(obj.description) ||
    text(obj.project_description) ||
    text(obj.idea_description) ||
    text(obj.proposed_solution) ||
    text(obj.solution)
  );
}

/* -------------------------------------------------------------------------- */
/* Load saved dashboard data                                                  */
/* -------------------------------------------------------------------------- */

function loadDashboardData(): DashboardData {
  const local = window.localStorage;
  const session = window.sessionStorage;

  const profileSources = [
    ...collectStoredValues(local, [
      'userProfile',
      'profile',
      'account',
      'user',
      'researchPilotProfile',
    ]),
    ...collectStoredValues(session, [
      'userProfile',
      'profile',
      'account',
      'researchPilotProfile',
    ]),
  ];

  const recommendationCaches = [
    ...collectMatchingStorage(local, [
      'researchpilot:recommendations:v1:',
      'researchpilot:last-recommendations:',
    ]),
    ...collectMatchingStorage(session, [
      'researchpilot:recommendations:v1:',
      'researchpilot:last-recommendations:',
    ]),
  ];

  const gapSources = [
    ...collectStoredValues(session, [
      'researchPilotDashboardGaps',
      'researchGaps',
      'researchGapTopics',
    ]),
    ...collectStoredValues(local, [
      'researchPilotDashboardGaps',
      'researchGaps',
      'researchGapTopics',
    ]),
    ...collectMatchingStorage(session, [
      'researchpilot:research-gaps:v1:',
    ]),
    ...collectMatchingStorage(local, [
      'researchpilot:research-gaps:v1:',
    ]),
  ];

  const ideaSources = [
    ...collectStoredValues(session, [
      'researchPilotDashboardIdeas',
      'projectIdeas',
      'generatedProjectIdeas',
      'researchPilotProjectIdeas',
    ]),
    ...collectStoredValues(local, [
      'researchPilotDashboardIdeas',
      'projectIdeas',
      'generatedProjectIdeas',
      'researchPilotProjectIdeas',
    ]),
  ];

  const paperSources = [
    ...collectStoredValues(session, [
      'researchPilotDashboardPapers',
      'recommendedPapers',
      'recommendations',
    ]),
    ...collectStoredValues(local, [
      'researchPilotDashboardPapers',
      'recommendedPapers',
      'recommendations',
    ]),
    ...recommendationCaches,
  ];

  const currentProject = asObject(
    parseJSON(
      session.getItem('researchPilotDashboardProject'),
    ) ??
      parseJSON(session.getItem('selectedProjectIdea')) ??
      parseJSON(session.getItem('researchPilotSelectedProject')) ??
      parseJSON(local.getItem('researchPilotDashboardProject')) ??
      parseJSON(local.getItem('selectedProjectIdea')),
  );

  const projectContext =
    parseJSON(
      session.getItem('researchPilotDashboardContext'),
    ) ??
    parseJSON(session.getItem('selectedProjectContext')) ??
    parseJSON(session.getItem('researchPilotProjectContext'));

  const facultyValue =
    parseJSON(
      session.getItem('researchPilotDashboardFaculty'),
    ) ??
    parseJSON(session.getItem('researchPilotFaculty')) ??
    parseJSON(local.getItem('researchPilotDashboardFaculty')) ??
    parseJSON(local.getItem('researchPilotFaculty'));

  const faculty = Array.isArray(facultyValue)
    ? facultyValue
    : findSectionArray(facultyValue, [
        'faculty',
        'faculty_matches',
        'facultyMatches',
        'recommended_faculty',
        'recommendedFaculty',
        'results',
        'items',
      ]);

  const groupValue =
    parseJSON(session.getItem('researchpilot_group_profile')) ??
    parseJSON(local.getItem('researchpilot_group_profile'));

  const groupData = asObject(groupValue);

  const groupMembersFromStorage = asArray(
    groupData?.members ??
      groupData?.group_members ??
      groupData?.groupMembers,
  );

  const paperArrays = paperSources.map((source) =>
    findSectionArray(source, [
      'recommended_papers',
      'recommendedPapers',
      'papers',
      'recommendations',
      'works',
      'results',
      'items',
    ]),
  );

  const gapArrays = gapSources.map((source) =>
    findSectionArray(source, [
      'research_gaps',
      'researchGaps',
      'identified_gaps',
      'identifiedGaps',
      'gap_list',
      'gaps',
      'research_gap',
      'gap_results',
    ]),
  );

  const ideaArrays = ideaSources.map((source) =>
    findSectionArray(source, [
      'project_ideas',
      'projectIdeas',
      'generated_ideas',
      'generatedIdeas',
      'ideas',
      'project_directions',
      'results',
      'items',
    ]),
  );

  const papers = uniqueRecords(
    paperArrays.flat(),
    'paper',
  );

  const gaps = uniqueRecords(
    gapArrays.flat(),
    'gap',
  ).slice(0, MAX_GAPS);

  const ideas = uniqueRecords(
    ideaArrays.flat(),
    'idea',
  ).slice(0, MAX_IDEAS);

  const allSources = [
    ...profileSources,
    ...recommendationCaches,
    ...gapSources,
    ...ideaSources,
    ...paperSources,
    projectContext,
    currentProject,
    groupData,
  ];

  const email =
    text(local.getItem('userEmail')) ||
    text(local.getItem('email')) ||
    text(session.getItem('researchGapEmail')) ||
    text(session.getItem('userEmail')) ||
    text(firstValue(allSources, ['email', 'user_email']));

  const interests =
    firstValue(allSources, [
      'interests',
      'research_interests',
      'researchInterests',
      'areas_of_interest',
    ]) ||
    session.getItem('researchInterests') ||
    session.getItem('interests') ||
    local.getItem('researchInterests') ||
    '';

  const goals =
    firstValue(allSources, [
      'goals',
      'research_goal',
      'research_goals',
      'researchGoals',
      'userGoals',
    ]) ||
    session.getItem('researchGoals') ||
    session.getItem('userGoals') ||
    local.getItem('researchGoals') ||
    '';

  const skills =
    firstValue(allSources, [
      'skills',
      'research_skills',
      'researchSkills',
      'userSkills',
    ]) ||
    session.getItem('researchSkills') ||
    session.getItem('userSkills') ||
    local.getItem('researchSkills') ||
    '';

  const recommendationData =
    recommendationCaches.length > 0
      ? recommendationCaches[recommendationCaches.length - 1]
      : null;

  const modeValue = text(
    firstValue(
      [
        recommendationData,
        ...recommendationCaches,
        projectContext,
        ...profileSources,
        groupData,
      ],
      [
        'mode',
        'recommendation_type',
        'recommendationType',
        'recommendation_mode',
        'type',
        'group_mode',
      ],
    ),
  );

  const mode =
    /group|team/i.test(modeValue) ||
    modeValue === 'true'
      ? 'Group recommendation'
      : /individual|single|personal/i.test(modeValue)
        ? 'Individual recommendation'
        : modeValue || 'Not recorded';

  const groupMembersFromRecommendations =
    recommendationCaches.flatMap((source) =>
      findSectionArray(source, [
        'group_members',
        'groupMembers',
        'members',
        'students',
        'team_members',
        'teamMembers',
      ]),
    );

  const groupMembers = uniqueRecords(
    [
      ...groupMembersFromStorage,
      ...groupMembersFromRecommendations,
    ],
    'faculty',
  );

  return {
    email,
    interests,
    goals,
    skills,
    mode,
    groupMembers,
    papers,
    gaps,
    ideas,
    selectedProject: currentProject,
    faculty: uniqueRecords(faculty, 'faculty'),
    recommendationData,
    profileData: profileSources[0] ?? null,
    groupData,
  };
}

/* -------------------------------------------------------------------------- */
/* Reusable UI components                                                     */
/* -------------------------------------------------------------------------- */

function Section({
  id,
  number,
  title,
  description,
  icon,
  children,
}: {
  id: string;
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            {icon}
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Section {number}
            </p>

            <h2 className="mt-1 text-lg font-bold text-slate-950">
              {title}
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-7">{children}</div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-center">
      <CircleHelp className="mx-auto h-6 w-6 text-slate-400" />

      <p className="mt-3 text-sm font-medium text-slate-700">
        No saved information found
      </p>

      <p className="mx-auto mt-1 max-w-lg text-xs leading-6 text-slate-500">
        {message}
      </p>
    </div>
  );
}

function ValueBlock({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  if (Array.isArray(value) && value.length === 0) {
    return null;
  }

  if (
    typeof value === 'string' &&
    ['[]', '{}', 'null', 'none', 'n/a'].includes(
      value.trim().toLowerCase(),
    )
  ) {
    return null;
  }

  const formattedValue = renderValue(value);

  if (formattedValue === 'Not available') return null;

  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
        {formattedValue}
      </p>
    </div>
  );
}

/* Faculty photo with automatic fallback to the next available URL. */
function FacultyPhoto({
  name,
  photoUrls,
}: {
  name: string;
  photoUrls: string[];
}) {
  const [sourceIndex, setSourceIndex] = useState(0);

  const currentPhoto = photoUrls[sourceIndex];

  if (!currentPhoto) {
    return (
      <div className="flex h-28 w-24 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-xl font-bold text-slate-500">
        {getFacultyInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={currentPhoto}
      alt={`${name} faculty photograph`}
      loading="lazy"
      className="h-28 w-24 shrink-0 rounded-xl border border-slate-200 bg-slate-100 object-cover object-center"
      onError={() => setSourceIndex((current) => current + 1)}
    />
  );
}

function DataCard({
  item,
  index,
  kind,
}: {
  item: unknown;
  index: number;
  kind: 'paper' | 'gap' | 'idea';
}) {
  const obj = asObject(item);

  const title = getTitle(
    item,
    kind === 'paper'
      ? `Research paper ${index + 1}`
      : kind === 'gap'
        ? `Research gap ${index + 1}`
        : `Project idea ${index + 1}`,
  );

  const url = kind === 'paper' ? getPaperUrl(item) : '';

  const excludedKeys = [
    'id',
    'paper_id',
    'work_id',
    'idea_id',
    'gap_id',
    'title',
    'name',
    'url',
    'paper_url',
    'doi_url',
    'openalex_url',
    'authors',
    'author',
    'author_names',
  ];

  const fields = obj
    ? Object.entries(obj).filter(
        ([key, value]) =>
          value !== null &&
          value !== undefined &&
          value !== '' &&
          !excludedKeys.includes(key) &&
          !isSensitiveProfileField(key) &&
          !isHiddenRecommendedTechnologiesField(key, value),
      )
    : [];

  const problemStatement =
    kind === 'idea' ? getProblemStatement(item) : '';

  const description =
    kind === 'idea' ? getProjectDescription(item) : '';

  return (
    <details className="group rounded-xl border border-slate-200 bg-white transition hover:border-slate-300">
      <summary className="flex cursor-pointer list-none items-start gap-3 p-4 sm:p-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
          {String(index + 1).padStart(2, '0')}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-6 text-slate-900">
            {title}
          </h3>

          {kind === 'paper' && getPaperAuthors(item) && (
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {getPaperAuthors(item)}
            </p>
          )}

          {kind === 'idea' && problemStatement && (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">
              <span className="font-semibold text-slate-700">
                Problem:
              </span>{' '}
              {problemStatement}
            </p>
          )}

          <p className="mt-2 text-xs text-slate-400">
            View full details
          </p>
        </div>

        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
      </summary>

      <div className="space-y-3 border-t border-slate-100 p-4 sm:p-5">
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 hover:text-blue-900"
          >
            Open paper <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        {kind === 'idea' && problemStatement && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-800">
              Problem statement
            </p>

            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
              {problemStatement}
            </p>
          </div>
        )}

        {kind === 'idea' && description && (
          <div className="rounded-xl border border-slate-100 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Project description / proposed solution
            </p>

            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
              {description}
            </p>
          </div>
        )}

        {fields.length > 0 ? (
          fields.map(([key, value]) => (
            <ValueBlock
              key={key}
              label={displayFieldName(key)}
              value={value}
            />
          ))
        ) : !problemStatement && !description ? (
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
            {renderValue(item)}
          </p>
        ) : null}
      </div>
    </details>
  );
}

function FacultyCard({
  member,
  index,
}: {
  member: unknown;
  index: number;
}) {
  const obj = asObject(member);

  const name = getFacultyName(member);
  const department = text(obj?.department);
  const designation = text(obj?.designation);
  const profileUrl = getFacultyProfileUrl(member);
  const photoUrls = getFacultyPhotoUrls(member);

  const expertise =
    obj?.research_areas ??
    obj?.areas_of_expertise ??
    obj?.expertise;

  const explanation =
    text(obj?.match_reason) ||
    text(obj?.explanation) ||
    text(obj?.reason);

  const score =
    obj?.match_score ??
    obj?.relevance_score ??
    obj?.score;

  const publications = asArray(
    obj?.publications ?? obj?.papers,
  );

  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm sm:p-5">
      {/* Faculty photo and identity */}
      <div className="flex items-start gap-4">
        <FacultyPhoto
          key={`${getFacultyId(member)}-${photoUrls.join('|')}`}
          name={name}
          photoUrls={photoUrls}
        />

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-bold text-white">
            {String(index + 1).padStart(2, '0')}
          </div>

          <h3 className="break-words text-sm font-bold leading-6 text-slate-950">
            {name}
          </h3>

          {(designation || department) && (
            <p className="mt-1 break-words text-xs leading-5 text-slate-500">
              {[designation, department]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}

          {score !== undefined &&
            score !== null &&
            score !== '' && (
              <p className="mt-2 inline-flex max-w-full flex-wrap rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">
                Match score: {String(score)}
              </p>
            )}
        </div>
      </div>

      {explanation && (
        <div className="mt-4 rounded-lg bg-slate-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Why this faculty member?
          </p>

          <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-700">
            {explanation}
          </p>
        </div>
      )}

      {expertise !== undefined && expertise !== null && (
        <div className="mt-4">
          <ValueBlock
            label="Research and expertise"
            value={expertise}
          />
        </div>
      )}

      {text(obj?.email) && (
        <a
          href={`mailto:${text(obj?.email)}`}
          className="mt-4 inline-flex items-center gap-2 break-all text-xs font-semibold text-blue-700 hover:text-blue-900"
        >
          Contact faculty <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      )}

      {publications.length > 0 && (
        <details className="mt-4 rounded-lg border border-slate-100 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-slate-700">
            Relevant publications ({publications.length})
          </summary>

          <ul className="mt-3 space-y-2">
            {publications.map((publication, publicationIndex) => (
              <li
                key={`${text(publication)}-${publicationIndex}`}
                className="break-words text-xs leading-6 text-slate-600"
              >
                {text(publication) || renderValue(publication)}
              </li>
            ))}
          </ul>
        </details>
      )}

      {profileUrl && (
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
        >
          View Faculty Profile
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Main dashboard                                                             */
/* -------------------------------------------------------------------------- */

export default function FinalDashboardPage() {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initializeDashboard() {
      let initialData = EMPTY_DATA;

      try {
        initialData = loadDashboardData();

        if (!cancelled) {
          setData(initialData);
        }
      } catch (error) {
        console.error(
          'Could not load the research dashboard:',
          error,
        );
      } finally {
        if (!cancelled) setLoading(false);
      }

      const email =
        initialData.email ||
        text(window.localStorage.getItem('userEmail')) ||
        text(window.localStorage.getItem('email')) ||
        text(window.sessionStorage.getItem('researchGapEmail')) ||
        text(window.sessionStorage.getItem('userEmail'));

      if (!email) return;

      if (!cancelled) setProfileLoading(true);

      try {
        const response = await fetch(PROFILE_API_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(
            `Profile request failed with status ${response.status}`,
          );
        }

        const responseData: unknown = await response.json();
        const profile = unwrapProfileResponse(responseData);
        const profileObject = asObject(profile);

        if (!profileObject) {
          throw new Error(
            'The profile endpoint did not return a profile object.',
          );
        }

        if (cancelled) return;

        const groupData = initialData.groupData;

        const interests = firstValue(
          [profileObject],
          [
            'interests',
            'research_interests',
            'researchInterests',
            'areas_of_interest',
          ],
        );

        const goals = firstValue(
          [profileObject],
          [
            'goals',
            'research_goal',
            'research_goals',
            'researchGoals',
            'userGoals',
          ],
        );

        const skills = firstValue(
          [profileObject],
          [
            'skills',
            'research_skills',
            'researchSkills',
            'userSkills',
          ],
        );

        setData((previous) => ({
          ...previous,
          email:
            text(profileObject.email) ||
            text(profileObject.user_email) ||
            previous.email ||
            email,
          interests: interests || previous.interests,
          goals: goals || previous.goals,
          skills: skills || previous.skills,
          profileData: profileObject,
          groupData,
        }));
      } catch (error) {
        console.warn(
          'Could not fetch the Neo4j-backed account profile. Using saved browser data instead.',
          error,
        );
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }

    void initializeDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const project = data.selectedProject;
  const profileObject = asObject(data.profileData);
  const groupData = data.groupData;

  const groupName =
    text(groupData?.groupName) ||
    text(groupData?.group_name) ||
    text(groupData?.name) ||
    'Research group';

  const accountFields = profileObject
    ? Object.entries(profileObject).filter(([key, value]) => {
        if (isSensitiveProfileField(key)) return false;

        if (
          value === null ||
          value === undefined ||
          value === ''
        ) {
          return false;
        }

        return ![
          'interests',
          'research_interests',
          'researchInterests',
          'areas_of_interest',
          'goals',
          'research_goal',
          'research_goals',
          'researchGoals',
          'userGoals',
          'skills',
          'research_skills',
          'researchSkills',
          'userSkills',
          'liked_works',
          'password_hash',
        ].includes(key);
      })
    : [];

  const isGroupMode =
    /group|team/i.test(data.mode) ||
    Boolean(groupData);

  const stats = [
    {
      label: 'Recommended papers',
      value: data.papers.length,
      icon: <BookOpen className="h-5 w-5" />,
    },
    {
      label: 'Research gaps',
      value: data.gaps.length,
      icon: <Search className="h-5 w-5" />,
    },
    {
      label: 'Project ideas',
      value: data.ideas.length,
      icon: <Lightbulb className="h-5 w-5" />,
    },
    {
      label: 'Faculty matches',
      value: data.faculty.length,
      icon: <GraduationCap className="h-5 w-5" />,
    },
  ];

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f9fc]">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-700" />

          <p className="mt-4 text-sm text-slate-600">
            Preparing your research dashboard…
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl print:static">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link
            href="/project-ideas"
            className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950 print:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Project Ideas</span>
          </Link>

          <Link
            href="/"
            className="text-center text-sm font-bold tracking-[0.16em] text-slate-950"
          >
            RESEARCHPILOT
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/account_view?returnTo=/final-dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800 print:hidden"
            >
              <UserRound className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </Link>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 print:hidden"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print / Save PDF</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 pb-20 pt-8 sm:px-8">
        {/* Hero */}
        <div className="mb-8 overflow-hidden rounded-3xl bg-slate-950 text-white shadow-lg">
          <div className="relative px-6 py-9 sm:px-10 sm:py-12">
            <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full bg-blue-600/30 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 right-1/3 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-100">
                <LayoutDashboard className="h-3.5 w-3.5" />
                Research journey overview
              </div>

              <h1 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
                Your research,
                <span className="block text-blue-300">
                  all in one place.
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Your research profile, personalized literature,
                identified gaps, project ideas, selected project,
                and aligned faculty expertise in one dashboard.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-slate-200">
                  {data.mode || 'Recommendation mode not recorded'}
                </span>

                {data.email && (
                  <span className="max-w-full break-all rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-slate-200">
                    {data.email}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Summary statistics */}
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                {stat.icon}
              </div>

              <p className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
                {stat.value}
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 print:hidden">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Jump to section
          </p>

          <div className="flex flex-wrap gap-2">
            {[
              ['profile', '01 · Research profile'],
              ['papers', '02 · Research papers'],
              ['gaps', '03 · Research gaps'],
              ['ideas', '04 · Project ideas'],
              ['selected-project', '05 · Selected project'],
              ['faculty', '06 · Faculty matches'],
            ].map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
              >
                {label}
              </a>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {/* SECTION 1: PROFILE */}
          <Section
            id="profile"
            number="01"
            title="Your research profile"
            description="Your saved account profile, research interests, goals, skills, and group information."
            icon={<UserRound className="h-5 w-5" />}
          >
            {isGroupMode && (
              <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-700" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Group research profile
                  </h3>
                </div>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {groupName}
                </p>

                {groupData && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <ValueBlock
                      label="Group ID"
                      value={
                        groupData.groupId ??
                        groupData.group_id
                      }
                    />

                    <ValueBlock
                      label="Member count"
                      value={groupMembersCount(
                        groupData,
                        data.groupMembers,
                      )}
                    />

                    <ValueBlock
                      label="Created"
                      value={
                        groupData.createdAt ??
                        groupData.created_at
                      }
                    />
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <ValueBlock
                label="Account email"
                value={data.email}
              />

              <ValueBlock
                label="Recommendation mode"
                value={data.mode}
              />

              <ValueBlock
                label="Research interests"
                value={data.interests}
              />

              <ValueBlock
                label="Research goals"
                value={data.goals}
              />

              <ValueBlock
                label="Skills"
                value={data.skills}
              />
            </div>

            {accountFields.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-3 text-sm font-bold text-slate-900">
                  Account details
                </h3>

                <div className="grid gap-3 sm:grid-cols-2">
                  {accountFields.map(([key, value]) => (
                    <ValueBlock
                      key={key}
                      label={displayFieldName(key)}
                      value={value}
                    />
                  ))}
                </div>
              </div>
            )}

            {profileLoading && (
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading the account profile from Flask…
              </div>
            )}

            {isGroupMode && (
              <div className="mt-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
                  <Users className="h-4 w-4" />
                  Group members and their profiles
                </h3>

                {data.groupMembers.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {data.groupMembers.map((member, index) => {
                      const obj = asObject(member);

                      const name =
                        text(obj?.name) ||
                        text(obj?.full_name) ||
                        text(obj?.email) ||
                        `Group member ${index + 1}`;

                      const memberFields = Object.entries(
                        obj ?? {},
                      ).filter(
                        ([key, value]) =>
                          !isSensitiveProfileField(key) &&
                          value !== null &&
                          value !== undefined &&
                          value !== '' &&
                          typeof value !== 'object',
                      );

                      return (
                        <article
                          key={`${text(obj?.email) || name}-${index}`}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-white">
                              {index + 1}
                            </div>

                            <div className="min-w-0">
                              <h4 className="break-words text-sm font-bold text-slate-900">
                                {name}
                              </h4>

                              {text(obj?.email) && (
                                <p className="mt-1 break-all text-xs text-slate-500">
                                  {text(obj?.email)}
                                </p>
                              )}
                            </div>
                          </div>

                          {memberFields.length > 0 && (
                            <div className="mt-4 grid gap-3">
                              {memberFields
                                .filter(
                                  ([key]) =>
                                    ![
                                      'name',
                                      'full_name',
                                      'email',
                                      'id',
                                    ].includes(key),
                                )
                                .map(([key, value]) => (
                                  <ValueBlock
                                    key={key}
                                    label={displayFieldName(key)}
                                    value={value}
                                  />
                                ))}
                            </div>
                          )}

                          {[
                            {
                              label: 'Research interests',
                              value:
                                obj?.interests ??
                                obj?.research_interests,
                            },
                            {
                              label: 'Research goals',
                              value:
                                obj?.goals ??
                                obj?.research_goal ??
                                obj?.research_goals,
                            },
                            {
                              label: 'Skills',
                              value: obj?.skills,
                            },
                          ].map(({ label, value }) =>
                            value !== undefined &&
                            value !== null &&
                            value !== '' ? (
                              <div className="mt-3" key={label}>
                                <ValueBlock
                                  label={label}
                                  value={value}
                                />
                              </div>
                            ) : null,
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState message="No group-member records were found in the saved group profile or recommendation data. To load the current group directly from Neo4j, the Flask backend must expose a group retrieval endpoint." />
                )}
              </div>
            )}

            {!data.interests && !data.goals && !data.skills && (
              <div className="mt-5">
                <EmptyState message="The account profile could not be populated. Verify that POST /get-profile accepts the logged-in email and returns the profile fields from Neo4j." />
              </div>
            )}

            {!data.profileData && !profileLoading && (
              <p className="mt-4 text-xs leading-6 text-slate-500">
                Account details are shown when available from the
                Flask profile response or saved browser data.
              </p>
            )}
          </Section>

          {/* SECTION 2: PAPERS */}
          <Section
            id="papers"
            number="02"
            title="Recommended research papers"
            description="Literature discovered through your personalized research recommendations."
            icon={<BookOpen className="h-5 w-5" />}
          >
            {data.papers.length > 0 ? (
              <div className="space-y-3">
                {data.papers.map((paper, index) => (
                  <DataCard
                    key={`${getTitle(paper, 'paper')}-${index}`}
                    item={paper}
                    index={index}
                    kind="paper"
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No paper list was found in the saved recommendation data. Check the storage key used by the working paper-recommendation page." />
            )}
          </Section>

          {/* SECTION 3: RESEARCH GAPS */}
          <Section
            id="gaps"
            number="03"
            title="Identified research gaps"
            description="The five generated research gaps, with their supporting evidence and descriptions."
            icon={<Search className="h-5 w-5" />}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-xs leading-5 text-slate-500">
                Showing up to five generated gaps.
              </p>

              <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                {data.gaps.length} / {MAX_GAPS}
              </span>
            </div>

            {data.gaps.length > 0 ? (
              <div className="space-y-3">
                {data.gaps.map((gap, index) => (
                  <DataCard
                    key={`${getTitle(gap, 'gap')}-${index}`}
                    item={gap}
                    index={index}
                    kind="gap"
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No generated research gaps were found in the dedicated gap storage keys. Ensure the research-gap page saves its five results under researchGaps or researchPilotDashboardGaps." />
            )}
          </Section>

          {/* SECTION 4: PROJECT IDEAS */}
          <Section
            id="ideas"
            number="04"
            title="Generated project ideas"
            description="Your five generated project directions, including their problem statements, proposed solutions, objectives, and supporting information."
            icon={<Lightbulb className="h-5 w-5" />}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-xs leading-5 text-slate-500">
                The selected project remains in this list.
              </p>

              <span className="shrink-0 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">
                {data.ideas.length} / {MAX_IDEAS}
              </span>
            </div>

            {data.ideas.length > 0 ? (
              <div className="space-y-3">
                {data.ideas.map((idea, index) => (
                  <DataCard
                    key={`${getTitle(idea, 'idea')}-${index}`}
                    item={idea}
                    index={index}
                    kind="idea"
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No generated project ideas were found. Check that the Project Ideas page saves its generated results to sessionStorage.projectIdeas or researchPilotDashboardIdeas, including each idea's problem_statement field." />
            )}
          </Section>

          {/* SECTION 5: SELECTED PROJECT */}
          <Section
            id="selected-project"
            number="05"
            title="Your selected project"
            description="The specific project selected for detailed planning and faculty expertise alignment."
            icon={<Target className="h-5 w-5" />}
          >
            {project ? (
              <div className="space-y-5">
                {/* Project title and main description */}
                <div className="rounded-2xl bg-slate-950 p-5 text-white sm:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-300">
                      Selected research direction
                    </p>

                    {(text(project.idea_id) ||
                      text(project.id) ||
                      text(project.project_id)) && (
                      <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100">
                        {formatIdentifierValue(
                          'idea_id',
                          project.idea_id ||
                            project.id ||
                            project.project_id,
                        ) || 'Selected idea'}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 max-w-4xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                    {getTitle(project, 'Selected project')}
                  </h3>

                  {getProblemStatement(project) && (
                    <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-300">
                        Problem statement
                      </p>

                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">
                        {getProblemStatement(project)}
                      </p>
                    </div>
                  )}

                  {getProjectDescription(project) && (
                    <div className="mt-5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Project description
                      </p>

                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">
                        {getProjectDescription(project)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Balanced project information layout */}
                {(() => {
                  const excludedProjectFields = [
                    'email',
                    'user_email',
                    'papers',
                    'research_gaps',
                    'researchGaps',
                    'problem_statement',
                    'problemStatement',
                    'problem_statement_text',
                    'problemStatementText',
                    'problem',
                    'description',
                    'project_description',
                    'idea_description',
                    'proposed_solution',
                    'solution',
                    'title',
                    'name',
                    'project_title',
                    'project_name',
                  ];

                  const projectFields = Object.entries(project).filter(
                    ([key, value]) =>
                      value !== null &&
                      value !== undefined &&
                      value !== '' &&
                      !excludedProjectFields.includes(key) &&
                      !isSensitiveProfileField(key) &&
                      !isHiddenRecommendedTechnologiesField(key, value),
                  );

                  const wideFieldPattern =
                    /research.?gap|supporting.?evidence|objectives?|methodology|approach|technolog|expected.?outcome|evaluation|implementation|scope|motivation|justification|background|description/i;

                  return projectFields.length > 0 ? (
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h4 className="text-sm font-bold text-slate-900">
                          Project details
                        </h4>

                        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          Project information
                        </span>
                      </div>

                      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
                        {projectFields.map(([key, value]) => {
                          const formattedValue =
                            key === 'idea_id' ||
                            key === 'project_idea_id' ||
                            key === 'gap_id' ||
                            key === 'research_gap_id'
                              ? formatIdentifierValue(key, value)
                              : value;

                          const isWide = wideFieldPattern.test(key);

                          return (
                            <div
                              key={key}
                              className={
                                isWide
                                  ? 'min-w-0 md:col-span-2'
                                  : 'min-w-0'
                              }
                            >
                              <ValueBlock
                                label={displayFieldName(key)}
                                value={formattedValue}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null;
                })()}

                {(text(project.idea_id) ||
                  text(project.id) ||
                  text(project.project_id)) && (
                  <Link
                    href={`/problem-statement/${encodeURIComponent(
                      text(
                        project.idea_id ||
                          project.id ||
                          project.project_id,
                      ),
                    )}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 print:hidden"
                  >
                    View project details
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                )}
              </div>
            ) : (
              <EmptyState message="The selected project was not found. Open a project from Project Ideas and ensure the selection is saved under researchPilotDashboardProject or selectedProjectIdea." />
            )}
          </Section>

          {/* SECTION 6: FACULTY */}
          <Section
            id="faculty"
            number="06"
            title="Recommended faculty"
            description="The three faculty recommendations aligned with your selected research project."
            icon={<GraduationCap className="h-5 w-5" />}
          >
            {data.faculty.length > 0 ? (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-xs leading-5 text-slate-500">
                    Faculty expertise and match explanations.
                  </p>

                  <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                    {data.faculty.length} matches
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {data.faculty.map((member, index) => (
                    <FacultyCard
                      key={`${getFacultyName(member)}-${index}`}
                      member={member}
                      index={index}
                    />
                  ))}
                </div>
              </>
            ) : (
              <EmptyState message="No saved faculty recommendations were found. Open the selected project's details page and ensure the three recommended faculty members are saved under researchPilotDashboardFaculty or researchPilotFaculty." />
            )}
          </Section>
        </div>

        {/* Footer */}
        <footer className="mt-10 rounded-2xl border border-slate-200 bg-white px-5 py-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <CheckCircle2 className="h-5 w-5" />
          </div>

          <h2 className="mt-3 font-bold text-slate-900">
            Your research journey, consolidated
          </h2>

          <p className="mx-auto mt-2 max-w-2xl text-xs leading-6 text-slate-500">
            Review the literature, validate the research gaps,
            refine your selected project, and discuss its
            feasibility with suitable faculty members.
          </p>

          <Link
            href="/project-ideas"
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 print:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to project ideas
          </Link>
        </footer>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Improved PDF / print layout                                        */}
      {/* ------------------------------------------------------------------ */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 12mm;
        }

        @media print {
          html,
          body {
            width: 100% !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }

          body {
            font-size: 10pt !important;
            line-height: 1.45 !important;
          }

          *,
          *::before,
          *::after {
            box-sizing: border-box !important;
            animation: none !important;
            transition: none !important;
            text-shadow: none !important;
          }

          .print\\:hidden {
            display: none !important;
          }

          header {
            position: static !important;
            top: auto !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 0 8mm !important;
            padding: 0 0 4mm !important;
            border: 0 !important;
            border-bottom: 1px solid #cbd5e1 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
          }

          header > div {
            display: flex !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            justify-content: center !important;
          }

          header a[href='/'] {
            display: inline-block !important;
            color: #0f172a !important;
            font-size: 12pt !important;
          }

          main,
          main > div,
          main > div > div {
            max-width: none !important;
          }

          main {
            min-height: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          main > div {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          main > div > div:first-child {
            margin: 0 0 7mm !important;
            padding: 0 !important;
            overflow: visible !important;
            border-radius: 8px !important;
            box-shadow: none !important;
            break-inside: avoid;
          }

          main > div > div:first-child > div {
            padding: 7mm !important;
            overflow: visible !important;
          }

          main > div > div:first-child h1 {
            font-size: 25pt !important;
            line-height: 1.15 !important;
          }

          main > div > div:nth-child(2) {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 3mm !important;
            margin-bottom: 7mm !important;
          }

          main > div > div:nth-child(2) > div {
            min-width: 0 !important;
            padding: 3mm !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 6px !important;
            box-shadow: none !important;
            break-inside: avoid;
          }

          .pointer-events-none {
            display: none !important;
          }

          main > div > div.space-y-6 {
            display: block !important;
          }

          main > div > div.space-y-6 > section {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 0 7mm !important;
            overflow: visible !important;
            border: 1px solid #dbe2ea !important;
            border-radius: 7px !important;
            background: #ffffff !important;
            box-shadow: none !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
          }

          main > div > div.space-y-6 > section > div:first-child {
            padding: 4mm !important;
            border-bottom: 1px solid #e2e8f0 !important;
            break-after: avoid-page !important;
            page-break-after: avoid !important;
          }

          main > div > div.space-y-6 > section > div:first-child h2 {
            font-size: 13pt !important;
            line-height: 1.3 !important;
          }

          main > div > div.space-y-6 > section > div:first-child p {
            line-height: 1.4 !important;
          }

          main > div > div.space-y-6 > section > div:last-child {
            padding: 4mm !important;
            overflow: visible !important;
          }

          article,
          details,
          .rounded-xl,
          .rounded-2xl {
            max-width: 100% !important;
            box-shadow: none !important;
          }

          article,
          details {
            break-inside: avoid-page;
            page-break-inside: avoid;
          }

          p,
          h1,
          h2,
          h3,
          h4,
          li,
          a,
          span {
            overflow-wrap: anywhere !important;
            word-break: normal !important;
          }

          p,
          li {
            orphans: 3;
            widows: 3;
          }

          details {
            overflow: visible !important;
            height: auto !important;
          }

          details > summary {
            display: flex !important;
            list-style: none !important;
            break-after: avoid-page !important;
            page-break-after: avoid !important;
          }

          details > summary::-webkit-details-marker {
            display: none !important;
          }

          details:not([open]) > *:not(summary) {
            display: block !important;
          }

          details > div {
            overflow: visible !important;
          }

          .grid {
            min-width: 0 !important;
            align-items: start !important;
          }

          .grid > * {
            min-width: 0 !important;
            max-width: 100% !important;
          }

          #faculty .grid {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 3mm !important;
          }

          #faculty article {
            padding: 3mm !important;
          }

          #faculty article p {
            font-size: 8pt !important;
            line-height: 1.35 !important;
          }

          .text-2xl {
            font-size: 17pt !important;
            line-height: 1.25 !important;
          }

          .text-lg {
            font-size: 12pt !important;
          }

          .text-sm {
            font-size: 9pt !important;
          }

          .text-xs {
            font-size: 8pt !important;
          }

          .leading-7 {
            line-height: 1.45 !important;
          }

          .leading-6 {
            line-height: 1.4 !important;
          }

          .shadow-sm,
          .shadow-lg {
            box-shadow: none !important;
          }

          .backdrop-blur-xl {
            backdrop-filter: none !important;
          }

          a {
            color: inherit !important;
            text-decoration: none !important;
          }

          svg {
            flex-shrink: 0 !important;
          }

          footer {
            margin-top: 5mm !important;
            padding: 5mm !important;
            border: 1px solid #dbe2ea !important;
            border-radius: 7px !important;
            background: #ffffff !important;
            box-shadow: none !important;
            break-inside: avoid-page;
            page-break-inside: avoid;
          }

          section {
            break-inside: auto !important;
            page-break-inside: auto !important;
          }

          section > div:first-child,
          .bg-blue-50\\/60,
          .bg-slate-950 {
            break-inside: avoid-page;
            page-break-inside: avoid;
          }
        }

        @media print and (max-width: 700px) {
          #faculty .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          main > div > div:nth-child(2) {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Group profile helper                                                       */
/* -------------------------------------------------------------------------- */

function groupMembersCount(
  group: AnyObject,
  members: unknown[],
): number {
  const explicitCount =
    group.memberCount ?? group.member_count;

  if (
    typeof explicitCount === 'number' &&
    Number.isFinite(explicitCount)
  ) {
    return explicitCount;
  }

  const storedMembers = asArray(
    group.members ??
      group.group_members ??
      group.groupMembers,
  );

  if (storedMembers.length > 0) return storedMembers.length;

  return members.length;
}
