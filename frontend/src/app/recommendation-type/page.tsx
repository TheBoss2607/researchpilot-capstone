'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Users,
  UserRound,
  User,
  Plus,
  X,
  Check,
  Loader2,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

type GroupMember = {
  id: number;
  name: string;
  email: string;
  interests: string[];
  customInterests: string;
  goals: string[];
  customGoals: string;
  skills: string[];
  customSkills: string;
  publications: string;
};

type LoggedInUser = {
  name: string;
  email: string;
};

// ============================================================
// CONSTANTS
// ============================================================

const API_URL = 'http://127.0.0.1:5000';

const MAX_ADDITIONAL_MEMBERS = 3;

const COMMON_INTERESTS = [
  'Artificial Intelligence',
  'Machine Learning',
  'Deep Learning',
  'Natural Language Processing',
  'Computer Vision',
  'Data Science',
  'Cybersecurity',
  'Cloud Computing',
  'Internet of Things',
  'Robotics',
  'Software Engineering',
  'Human-Computer Interaction',
  'Blockchain',
  'Healthcare Technology',
  'Computer Networks',
];

const COMMON_GOALS = [
  'Find a research topic',
  'Identify research gaps',
  'Publish a research paper',
  'Build a research project',
  'Develop a new solution',
  'Explore a new research area',
  'Prepare for higher studies',
  'Work on an industry problem',
];

const COMMON_SKILLS = [
  'Python',
  'Java',
  'C++',
  'JavaScript',
  'TypeScript',
  'React',
  'Next.js',
  'Machine Learning',
  'Deep Learning',
  'Data Analysis',
  'NLP',
  'Computer Vision',
  'Web Development',
  'Database Management',
  'Research & Literature Review',
];

// ============================================================
// COMPONENT
// ============================================================

export default function RecommendationTypePage() {
  // ==========================================================
  // GROUP MODAL
  // ==========================================================

  const [showGroupSetup, setShowGroupSetup] = useState(false);

  // ==========================================================
  // LOGGED-IN USER
  //
  // The email is retrieved from localStorage because the
  // existing login endpoint returns the user's email but does
  // not create a Flask session.
  // ==========================================================

  const [loggedInUser, setLoggedInUser] = useState<LoggedInUser>({
    name: 'You',
    email: '',
  });

  // ==========================================================
  // LOAD LOGGED-IN USER
  // ==========================================================

  useEffect(() => {
    const storedEmail = localStorage.getItem('userEmail');

    if (storedEmail) {
      setLoggedInUser({
        name: 'You',
        email: storedEmail,
      });
    }
  }, []);

  // ==========================================================
  // ADDITIONAL GROUP MEMBERS
  //
  // IMPORTANT:
  // The owner is NOT stored here.
  // These are ONLY the additional members.
  // ==========================================================

  const [members, setMembers] = useState<GroupMember[]>([]);

  // ==========================================================
  // ACTIVE MEMBER
  // ==========================================================

  const [activeMember, setActiveMember] = useState(0);

  // ==========================================================
  // ERROR / LOADING
  // ==========================================================

  const [error, setError] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // ==========================================================
  // ADD MEMBER
  // ==========================================================

  const addMember = () => {
    if (members.length >= MAX_ADDITIONAL_MEMBERS) {
      return;
    }

    const newMember: GroupMember = {
      id: Date.now(),
      name: '',
      email: '',
      interests: [],
      customInterests: '',
      goals: [],
      customGoals: '',
      skills: [],
      customSkills: '',
      publications: '',
    };

    setMembers((previous) => [...previous, newMember]);

    setActiveMember(members.length);

    setError('');
  };

  // ==========================================================
  // REMOVE MEMBER
  // ==========================================================

  const removeMember = (index: number) => {
    setMembers((previous) =>
      previous.filter((_, i) => i !== index)
    );

    if (members.length === 1) {
      setActiveMember(0);
    } else if (activeMember >= members.length - 1) {
      setActiveMember(Math.max(0, members.length - 2));
    }

    setError('');
  };

  // ==========================================================
  // UPDATE MEMBER FIELD
  // ==========================================================

  const updateMember = (
    index: number,
    field: keyof GroupMember,
    value: string | string[]
  ) => {
    setMembers((previous) =>
      previous.map((member, i) =>
        i === index
          ? {
              ...member,
              [field]: value,
            }
          : member
      )
    );

    setError('');
  };

  // ==========================================================
  // TOGGLE ARRAY OPTION
  // ==========================================================

  const toggleOption = (
    index: number,
    field: 'interests' | 'goals' | 'skills',
    option: string
  ) => {
    const member = members[index];

    if (!member) {
      return;
    }

    const currentValues = member[field];

    const exists = currentValues.includes(option);

    const updatedValues = exists
      ? currentValues.filter((value) => value !== option)
      : [...currentValues, option];

    updateMember(index, field, updatedValues);
  };

  // ==========================================================
  // OPEN GROUP SETUP
  // ==========================================================

  const openGroupSetup = () => {
    const storedEmail = localStorage.getItem('userEmail');

    if (storedEmail) {
      setLoggedInUser({
        name: 'You',
        email: storedEmail,
      });
    }

    setShowGroupSetup(true);
    setActiveMember(0);
    setError('');
  };

  // ==========================================================
  // CLOSE GROUP SETUP
  // ==========================================================

  const closeGroupSetup = () => {
    if (isCreatingGroup) {
      return;
    }

    setShowGroupSetup(false);
    setError('');
  };

  // ==========================================================
  // VALIDATE MEMBER
  // ==========================================================

  const validateMember = (member: GroupMember) => {
    if (!member.name.trim()) {
      return 'Please enter the member name.';
    }

    if (!member.email.trim()) {
      return 'Please enter the member email.';
    }

    if (
      !member.email.includes('@') ||
      !member.email.includes('.')
    ) {
      return 'Please enter a valid member email.';
    }

    if (
      member.interests.length === 0 &&
      !member.customInterests.trim()
    ) {
      return 'Please select or enter at least one research interest.';
    }

    if (
      member.goals.length === 0 &&
      !member.customGoals.trim()
    ) {
      return 'Please select or enter at least one research goal.';
    }

    if (
      member.skills.length === 0 &&
      !member.customSkills.trim()
    ) {
      return 'Please select or enter at least one skill.';
    }

    return '';
  };

  // ==========================================================
  // NEXT MEMBER
  // ==========================================================

  const nextMember = () => {
    if (members.length === 0) {
      setError('Please add at least one group member.');
      return;
    }

    const currentMember = members[activeMember];

    if (!currentMember) {
      return;
    }

    const validationError = validateMember(currentMember);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (activeMember < members.length - 1) {
      setActiveMember((previous) => previous + 1);
      setError('');
    }
  };

  // ==========================================================
  // PREVIOUS MEMBER
  // ==========================================================

  const previousMember = () => {
    if (activeMember > 0) {
      setActiveMember((previous) => previous - 1);
      setError('');
    }
  };

  // ==========================================================
  // CREATE GROUP
  // ==========================================================

  const createGroup = async () => {
    // --------------------------------------------------------
    // A group must contain at least one additional member.
    // --------------------------------------------------------

    if (members.length === 0) {
      setError(
        'Please add at least one additional group member.'
      );
      return;
    }

    // --------------------------------------------------------
    // Get the real logged-in user's email.
    // --------------------------------------------------------

    const ownerEmail =
      localStorage.getItem('userEmail') ||
      loggedInUser.email.trim();

    if (!ownerEmail) {
      setError(
        'Unable to identify your account. Please log in again.'
      );
      return;
    }

    // --------------------------------------------------------
    // Validate all additional members.
    // --------------------------------------------------------

    for (let i = 0; i < members.length; i++) {
      const validationError = validateMember(members[i]);

      if (validationError) {
        setActiveMember(i);

        setError(
          `Member ${i + 1}: ${validationError}`
        );

        return;
      }
    }

    // --------------------------------------------------------
    // Prevent the owner from being added as another member.
    // --------------------------------------------------------

    const duplicateOwner = members.some(
      (member) =>
        member.email.trim().toLowerCase() ===
        ownerEmail.trim().toLowerCase()
    );

    if (duplicateOwner) {
      setError(
        'The group owner cannot be added as an additional member.'
      );
      return;
    }

    // --------------------------------------------------------
    // Construct the payload expected by Flask.
    //
    // IMPORTANT:
    // The backend generates the actual group_id.
    // --------------------------------------------------------

    const groupPayload = {
      owner_email: ownerEmail.trim(),

      members: members.map((member) => ({
        name: member.name.trim(),

        email: member.email.trim(),

        interests: Array.from(
          new Set([
            ...member.interests,
            ...member.customInterests
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
          ])
        ),

        goals: Array.from(
          new Set([
            ...member.goals,
            ...member.customGoals
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
          ])
        ),

        skills: Array.from(
          new Set([
            ...member.skills,
            ...member.customSkills
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
          ])
        ),

        publications: member.publications.trim(),
      })),
    };

    // --------------------------------------------------------
    // START LOADING
    // --------------------------------------------------------

    setIsCreatingGroup(true);
    setError('');

    try {
      // ======================================================
      // SEND TO FLASK
      // ======================================================

      const response = await fetch(
        `${API_URL}/group/create`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify(groupPayload),
        }
      );

      // ------------------------------------------------------
      // Read response
      // ------------------------------------------------------

      let data: any = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      // ------------------------------------------------------
      // Backend error
      // ------------------------------------------------------

      if (!response.ok) {
        const errorMessage =
          data?.error ||
          data?.message ||
          'Unable to create the research group.';

        throw new Error(errorMessage);
      }

      // ------------------------------------------------------
      // Confirm backend success
      // ------------------------------------------------------

      if (data?.status !== 'success') {
        throw new Error(
          data?.message ||
            'The research group could not be created.'
        );
      }

      // ------------------------------------------------------
      // Store the actual backend group information.
      // ------------------------------------------------------

      const savedGroupProfile = {
        groupId: data.group_id,

        owner: {
          name: loggedInUser.name,
          email: data.owner_email || ownerEmail,
        },

        memberCount: data.member_count,

        additionalMemberCount:
          data.additional_member_count,

        members: data.members || groupPayload.members,
      };

      sessionStorage.setItem(
        'researchpilot_group_profile',
        JSON.stringify(savedGroupProfile)
      );

      // ------------------------------------------------------
      // Move to existing interests page ONLY after successful
      // Neo4j/backend creation.
      // ------------------------------------------------------

      window.location.href = '/interests';

    } catch (error) {
      console.error(
        'Group creation failed:',
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : 'Unable to create the research group.'
      );

      setIsCreatingGroup(false);
    }
  };

  // ==========================================================
  // CURRENT MEMBER
  // ==========================================================

  const currentMember =
    members.length > 0
      ? members[activeMember]
      : null;

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900">

      {/* ===================================================== */}
      {/* HEADER */}
      {/* ===================================================== */}

      <header className="border-b border-slate-200 bg-white">

        <div
          className="
            mx-auto
            flex
            h-20
            w-full
            max-w-6xl
            items-center
            justify-between
            px-6
            md:px-8
          "
        >

          <div>

            <Link
              href="/recommendation-type"
              className="
                text-xl
                font-semibold
                tracking-tight
                text-slate-900
              "
            >
              RESEARCHPILOT
            </Link>

            <p className="mt-0.5 text-xs text-slate-500">
              Research discovery & guidance
            </p>

          </div>

          <Link
            href="/account_view?returnTo=/recommendation-type"
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              border
              border-slate-200
              bg-white
              px-4
              py-2
              text-sm
              font-medium
              text-slate-600
              transition-colors
              hover:border-slate-300
              hover:bg-slate-50
              hover:text-slate-900
            "
          >
            <User className="h-4 w-4" />
            Profile
          </Link>

        </div>

      </header>

      {/* ===================================================== */}
      {/* MAIN */}
      {/* ===================================================== */}

      <section
        className="
          mx-auto
          flex
          min-h-[calc(100vh-80px)]
          w-full
          max-w-5xl
          items-center
          px-6
          py-16
          md:px-8
        "
      >

        <div className="w-full">

          {/* ================================================= */}
          {/* INTRO */}
          {/* ================================================= */}

          <div className="mx-auto mb-12 max-w-2xl text-center">

            <div
              className="
                mx-auto
                mb-6
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-xl
                bg-slate-100
                text-slate-700
              "
            >
              <UserRound className="h-5 w-5" />
            </div>

            <p className="mb-3 text-sm font-medium text-slate-500">
              RESEARCH DISCOVERY
            </p>

            <h1
              className="
                text-3xl
                font-semibold
                tracking-tight
                text-slate-900
                md:text-4xl
              "
            >
              How would you like to research?
            </h1>

            <p
              className="
                mx-auto
                mt-4
                max-w-xl
                text-base
                leading-7
                text-slate-500
                md:text-lg
              "
            >
              Choose how you want to explore research opportunities.
              You can work independently or collaborate with a group.
            </p>

          </div>

          {/* ================================================= */}
          {/* OPTIONS */}
          {/* ================================================= */}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

            {/* =============================================== */}
            {/* INDIVIDUAL */}
            {/* =============================================== */}

            <Link
              href="/interests"
              className="group"
            >

              <div
                className="
                  h-full
                  rounded-2xl
                  border
                  border-slate-200
                  bg-white
                  p-8
                  shadow-sm
                  transition-all
                  duration-200
                  hover:-translate-y-1
                  hover:border-slate-300
                  hover:shadow-lg
                "
              >

                <div
                  className="
                    mb-8
                    flex
                    h-12
                    w-12
                    items-center
                    justify-center
                    rounded-xl
                    bg-slate-900
                    text-white
                  "
                >
                  <UserRound className="h-5 w-5" />
                </div>

                <h2 className="text-xl font-semibold text-slate-900">
                  Individual Research
                </h2>

                <p className="mt-3 min-h-[56px] text-sm leading-6 text-slate-500">
                  Tell us about your research interests and goals,
                  then discover papers and research directions
                  personalized to you.
                </p>

                <div
                  className="
                    mt-8
                    flex
                    items-center
                    text-sm
                    font-medium
                    text-slate-900
                  "
                >
                  Start individual research

                  <ArrowRight
                    className="
                      ml-2
                      h-4
                      w-4
                      transition-transform
                      duration-200
                      group-hover:translate-x-1
                    "
                  />

                </div>

              </div>

            </Link>

            {/* =============================================== */}
            {/* GROUP */}
            {/* =============================================== */}

            <button
              type="button"
              onClick={openGroupSetup}
              className="group text-left"
            >

              <div
                className="
                  h-full
                  rounded-2xl
                  border
                  border-slate-200
                  bg-white
                  p-8
                  shadow-sm
                  transition-all
                  duration-200
                  hover:-translate-y-1
                  hover:border-slate-300
                  hover:shadow-lg
                "
              >

                <div
                  className="
                    mb-8
                    flex
                    h-12
                    w-12
                    items-center
                    justify-center
                    rounded-xl
                    bg-slate-900
                    text-white
                  "
                >
                  <Users className="h-5 w-5" />
                </div>

                <h2 className="text-xl font-semibold text-slate-900">
                  Group Research
                </h2>

                <p className="mt-3 min-h-[56px] text-sm leading-6 text-slate-500">
                  Collaborate with other researchers and discover
                  research opportunities based on the combined
                  interests and goals of your group.
                </p>

                <div
                  className="
                    mt-8
                    flex
                    items-center
                    text-sm
                    font-medium
                    text-slate-900
                  "
                >
                  Create a research group

                  <ArrowRight
                    className="
                      ml-2
                      h-4
                      w-4
                      transition-transform
                      duration-200
                      group-hover:translate-x-1
                    "
                  />

                </div>

              </div>

            </button>

          </div>

          {/* ================================================= */}
          {/* SUPPORTING TEXT */}
          {/* ================================================= */}

          <p className="mt-10 text-center text-xs text-slate-400">
            Your research interests and goals will guide your
            personalized recommendations.
          </p>

        </div>

      </section>

      {/* ===================================================== */}
      {/* GROUP SETUP MODAL */}
      {/* ===================================================== */}

      {showGroupSetup && (

        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-slate-900/40
            p-4
            backdrop-blur-sm
          "
        >

          <div
            className="
              flex
              max-h-[92vh]
              w-full
              max-w-5xl
              flex-col
              overflow-hidden
              rounded-2xl
              border
              border-slate-200
              bg-white
              shadow-2xl
            "
          >

            {/* ================================================= */}
            {/* MODAL HEADER */}
            {/* ================================================= */}

            <div
              className="
                flex
                items-center
                justify-between
                border-b
                border-slate-200
                px-6
                py-5
                md:px-8
              "
            >

              <div className="flex items-center gap-3">

                <div
                  className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-xl
                    bg-slate-900
                    text-white
                  "
                >
                  <Users className="h-5 w-5" />
                </div>

                <div>

                  <h2 className="text-lg font-semibold text-slate-900">
                    Create Research Group
                  </h2>

                  <p className="text-sm text-slate-500">
                    Add up to 3 additional researchers.
                  </p>

                </div>

              </div>

              <button
                type="button"
                onClick={closeGroupSetup}
                disabled={isCreatingGroup}
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-lg
                  text-slate-400
                  transition-colors
                  hover:bg-slate-100
                  hover:text-slate-700
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                <X className="h-5 w-5" />
              </button>

            </div>

            {/* ================================================= */}
            {/* MODAL BODY */}
            {/* ================================================= */}

            <div className="flex min-h-0 flex-1 flex-col md:flex-row">

              {/* =============================================== */}
              {/* GROUP SIDEBAR */}
              {/* =============================================== */}

              <aside
                className="
                  w-full
                  border-b
                  border-slate-200
                  bg-slate-50
                  md:w-64
                  md:border-b-0
                  md:border-r
                "
              >

                <div className="p-5">

                  {/* ============================================ */}
                  {/* OWNER */}
                  {/* ============================================ */}

                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Group owner
                  </p>

                  <div
                    className="
                      flex
                      items-center
                      gap-3
                      rounded-xl
                      border
                      border-slate-200
                      bg-white
                      px-3
                      py-3
                      shadow-sm
                    "
                  >

                    <div
                      className="
                        flex
                        h-9
                        w-9
                        items-center
                        justify-center
                        rounded-lg
                        bg-slate-900
                        text-white
                      "
                    >
                      <UserRound className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">

                      <p className="truncate text-sm font-medium text-slate-900">
                        {loggedInUser.name}
                      </p>

                      <p className="truncate text-xs text-slate-400">
                        {loggedInUser.email || 'Your account'}
                      </p>

                    </div>

                    <Check className="h-4 w-4 text-slate-500" />

                  </div>

                  {/* ============================================ */}
                  {/* MEMBERS */}
                  {/* ============================================ */}

                  <div className="mb-3 mt-7 flex items-center justify-between">

                    <div>

                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Additional members
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {members.length} of 3
                      </p>

                    </div>

                  </div>

                  {/* ============================================ */}
                  {/* MEMBER LIST */}
                  {/* ============================================ */}

                  <div className="space-y-2">

                    {members.map((member, index) => (

                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          setActiveMember(index);
                          setError('');
                        }}
                        className={`
                          flex
                          w-full
                          items-center
                          gap-3
                          rounded-xl
                          border
                          px-3
                          py-3
                          text-left
                          transition-colors
                          ${
                            activeMember === index
                              ? 'border-slate-300 bg-white shadow-sm'
                              : 'border-transparent hover:bg-white'
                          }
                        `}
                      >

                        <div
                          className={`
                            flex
                            h-9
                            w-9
                            shrink-0
                            items-center
                            justify-center
                            rounded-lg
                            ${
                              activeMember === index
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-200 text-slate-500'
                            }
                          `}
                        >
                          <User className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">

                          <p className="truncate text-sm font-medium text-slate-700">
                            {member.name.trim() ||
                              `Member ${index + 1}`}
                          </p>

                          <p className="text-xs text-slate-400">
                            Additional member
                          </p>

                        </div>

                      </button>

                    ))}

                  </div>

                  {/* ============================================ */}
                  {/* ADD MEMBER */}
                  {/* ============================================ */}

                  {members.length < MAX_ADDITIONAL_MEMBERS && (

                    <button
                      type="button"
                      onClick={addMember}
                      className="
                        mt-4
                        flex
                        w-full
                        items-center
                        justify-center
                        gap-2
                        rounded-xl
                        border
                        border-dashed
                        border-slate-300
                        px-3
                        py-3
                        text-sm
                        font-medium
                        text-slate-600
                        transition-colors
                        hover:border-slate-400
                        hover:bg-white
                        hover:text-slate-900
                      "
                    >
                      <Plus className="h-4 w-4" />
                      Add member
                    </button>

                  )}

                  {members.length === MAX_ADDITIONAL_MEMBERS && (

                    <p className="mt-4 text-center text-xs text-slate-400">
                      Maximum of 3 additional members reached.
                    </p>

                  )}

                </div>

              </aside>

              {/* =============================================== */}
              {/* MEMBER FORM */}
              {/* =============================================== */}

              <div className="min-h-0 flex-1 overflow-y-auto">

                {currentMember ? (

                  <div className="p-6 md:p-8">

                    {/* ========================================== */}
                    {/* MEMBER HEADER */}
                    {/* ========================================== */}

                    <div className="mb-8 flex items-start justify-between gap-4">

                      <div>

                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Additional member {activeMember + 1}
                        </p>

                        <h3 className="mt-1 text-xl font-semibold text-slate-900">
                          {currentMember.name.trim() ||
                            'Researcher profile'}
                        </h3>

                        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                          Enter this researcher's information so
                          RESEARCHPILOT can include their profile
                          when generating group recommendations.
                        </p>

                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          removeMember(activeMember)
                        }
                        disabled={isCreatingGroup}
                        className="
                          inline-flex
                          shrink-0
                          items-center
                          gap-1.5
                          rounded-lg
                          px-3
                          py-2
                          text-xs
                          font-medium
                          text-slate-500
                          transition-colors
                          hover:bg-red-50
                          hover:text-red-600
                          disabled:opacity-50
                        "
                      >
                        <X className="h-3.5 w-3.5" />
                        Remove
                      </button>

                    </div>

                    {/* ========================================== */}
                    {/* BASIC INFORMATION */}
                    {/* ========================================== */}

                    <div className="space-y-6">

                      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

                        {/* NAME */}

                        <div>

                          <label className="mb-2 block text-sm font-medium text-slate-700">
                            Full name
                            <span className="ml-1 text-red-500">
                              *
                            </span>
                          </label>

                          <input
                            type="text"
                            value={currentMember.name}
                            onChange={(event) =>
                              updateMember(
                                activeMember,
                                'name',
                                event.target.value
                              )
                            }
                            placeholder="Enter member name"
                            disabled={isCreatingGroup}
                            className="
                              w-full
                              rounded-lg
                              border
                              border-slate-200
                              bg-white
                              px-3.5
                              py-2.5
                              text-sm
                              text-slate-900
                              outline-none
                              transition
                              placeholder:text-slate-400
                              focus:border-slate-400
                              focus:ring-2
                              focus:ring-slate-100
                              disabled:bg-slate-50
                            "
                          />

                        </div>

                        {/* EMAIL */}

                        <div>

                          <label className="mb-2 block text-sm font-medium text-slate-700">
                            Email
                            <span className="ml-1 text-red-500">
                              *
                            </span>
                          </label>

                          <input
                            type="email"
                            value={currentMember.email}
                            onChange={(event) =>
                              updateMember(
                                activeMember,
                                'email',
                                event.target.value
                              )
                            }
                            placeholder="name@example.com"
                            disabled={isCreatingGroup}
                            className="
                              w-full
                              rounded-lg
                              border
                              border-slate-200
                              bg-white
                              px-3.5
                              py-2.5
                              text-sm
                              text-slate-900
                              outline-none
                              transition
                              placeholder:text-slate-400
                              focus:border-slate-400
                              focus:ring-2
                              focus:ring-slate-100
                              disabled:bg-slate-50
                            "
                          />

                        </div>

                      </div>

                      {/* ================================================= */}
                      {/* INTERESTS */}
                      {/* ================================================= */}

                      <div>

                        <div className="mb-3">

                          <label className="text-sm font-medium text-slate-700">
                            Research interests
                            <span className="ml-1 text-red-500">
                              *
                            </span>
                          </label>

                          <p className="mt-1 text-xs text-slate-400">
                            Select common areas or enter your own.
                          </p>

                        </div>

                        <div className="flex flex-wrap gap-2">

                          {COMMON_INTERESTS.map((interest) => {

                            const selected =
                              currentMember.interests.includes(
                                interest
                              );

                            return (

                              <button
                                key={interest}
                                type="button"
                                disabled={isCreatingGroup}
                                onClick={() =>
                                  toggleOption(
                                    activeMember,
                                    'interests',
                                    interest
                                  )
                                }
                                className={`
                                  rounded-full
                                  border
                                  px-3
                                  py-1.5
                                  text-xs
                                  font-medium
                                  transition-colors
                                  ${
                                    selected
                                      ? 'border-slate-900 bg-slate-900 text-white'
                                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                                  }
                                `}
                              >
                                {selected && (
                                  <Check className="mr-1 inline h-3 w-3" />
                                )}
                                {interest}
                              </button>

                            );

                          })}

                        </div>

                        <input
                          type="text"
                          value={currentMember.customInterests}
                          onChange={(event) =>
                            updateMember(
                              activeMember,
                              'customInterests',
                              event.target.value
                            )
                          }
                          placeholder="Other interests — e.g. Quantum Computing, Bioinformatics"
                          disabled={isCreatingGroup}
                          className="
                            mt-4
                            w-full
                            rounded-lg
                            border
                            border-slate-200
                            bg-white
                            px-3.5
                            py-2.5
                            text-sm
                            text-slate-900
                            outline-none
                            transition
                            placeholder:text-slate-400
                            focus:border-slate-400
                            focus:ring-2
                            focus:ring-slate-100
                            disabled:bg-slate-50
                          "
                        />

                        <p className="mt-1.5 text-xs text-slate-400">
                          Separate custom interests with commas.
                        </p>

                      </div>

                      {/* ================================================= */}
                      {/* GOALS */}
                      {/* ================================================= */}

                      <div>

                        <div className="mb-3">

                          <label className="text-sm font-medium text-slate-700">
                            Research goals
                            <span className="ml-1 text-red-500">
                              *
                            </span>
                          </label>

                          <p className="mt-1 text-xs text-slate-400">
                            Select one or more goals or add your own.
                          </p>

                        </div>

                        <div className="flex flex-wrap gap-2">

                          {COMMON_GOALS.map((goal) => {

                            const selected =
                              currentMember.goals.includes(
                                goal
                              );

                            return (

                              <button
                                key={goal}
                                type="button"
                                disabled={isCreatingGroup}
                                onClick={() =>
                                  toggleOption(
                                    activeMember,
                                    'goals',
                                    goal
                                  )
                                }
                                className={`
                                  rounded-full
                                  border
                                  px-3
                                  py-1.5
                                  text-xs
                                  font-medium
                                  transition-colors
                                  ${
                                    selected
                                      ? 'border-slate-900 bg-slate-900 text-white'
                                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                                  }
                                `}
                              >
                                {selected && (
                                  <Check className="mr-1 inline h-3 w-3" />
                                )}
                                {goal}
                              </button>

                            );

                          })}

                        </div>

                        <input
                          type="text"
                          value={currentMember.customGoals}
                          onChange={(event) =>
                            updateMember(
                              activeMember,
                              'customGoals',
                              event.target.value
                            )
                          }
                          placeholder="Other goals — e.g. Develop an assistive AI system"
                          disabled={isCreatingGroup}
                          className="
                            mt-4
                            w-full
                            rounded-lg
                            border
                            border-slate-200
                            bg-white
                            px-3.5
                            py-2.5
                            text-sm
                            text-slate-900
                            outline-none
                            transition
                            placeholder:text-slate-400
                            focus:border-slate-400
                            focus:ring-2
                            focus:ring-slate-100
                            disabled:bg-slate-50
                          "
                        />

                      </div>

                      {/* ================================================= */}
                      {/* SKILLS */}
                      {/* ================================================= */}

                      <div>

                        <div className="mb-3">

                          <label className="text-sm font-medium text-slate-700">
                            Skills
                            <span className="ml-1 text-red-500">
                              *
                            </span>
                          </label>

                          <p className="mt-1 text-xs text-slate-400">
                            Select skills or add your own.
                          </p>

                        </div>

                        <div className="flex flex-wrap gap-2">

                          {COMMON_SKILLS.map((skill) => {

                            const selected =
                              currentMember.skills.includes(
                                skill
                              );

                            return (

                              <button
                                key={skill}
                                type="button"
                                disabled={isCreatingGroup}
                                onClick={() =>
                                  toggleOption(
                                    activeMember,
                                    'skills',
                                    skill
                                  )
                                }
                                className={`
                                  rounded-full
                                  border
                                  px-3
                                  py-1.5
                                  text-xs
                                  font-medium
                                  transition-colors
                                  ${
                                    selected
                                      ? 'border-slate-900 bg-slate-900 text-white'
                                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                                  }
                                `}
                              >
                                {selected && (
                                  <Check className="mr-1 inline h-3 w-3" />
                                )}
                                {skill}
                              </button>

                            );

                          })}

                        </div>

                        <input
                          type="text"
                          value={currentMember.customSkills}
                          onChange={(event) =>
                            updateMember(
                              activeMember,
                              'customSkills',
                              event.target.value
                            )
                          }
                          placeholder="Other skills — e.g. MATLAB, TensorFlow, Figma"
                          disabled={isCreatingGroup}
                          className="
                            mt-4
                            w-full
                            rounded-lg
                            border
                            border-slate-200
                            bg-white
                            px-3.5
                            py-2.5
                            text-sm
                            text-slate-900
                            outline-none
                            transition
                            placeholder:text-slate-400
                            focus:border-slate-400
                            focus:ring-2
                            focus:ring-slate-100
                            disabled:bg-slate-50
                          "
                        />

                      </div>

                      {/* ================================================= */}
                      {/* PUBLICATIONS */}
                      {/* ================================================= */}

                      <div>

                        <div className="mb-3">

                          <label className="text-sm font-medium text-slate-700">
                            Publications
                          </label>

                          <p className="mt-1 text-xs text-slate-400">
                            Optional. Add publication titles, links, or
                            a short description of previous research.
                          </p>

                        </div>

                        <textarea
                          value={currentMember.publications}
                          onChange={(event) =>
                            updateMember(
                              activeMember,
                              'publications',
                              event.target.value
                            )
                          }
                          placeholder="Example: Research paper on machine learning for medical image analysis..."
                          disabled={isCreatingGroup}
                          rows={4}
                          className="
                            w-full
                            resize-none
                            rounded-lg
                            border
                            border-slate-200
                            bg-white
                            px-3.5
                            py-2.5
                            text-sm
                            text-slate-900
                            outline-none
                            transition
                            placeholder:text-slate-400
                            focus:border-slate-400
                            focus:ring-2
                            focus:ring-slate-100
                            disabled:bg-slate-50
                          "
                        />

                      </div>

                    </div>

                  </div>

                ) : (

                  /* ================================================= */
                  /* NO MEMBERS */
                  /* ================================================= */

                  <div
                    className="
                      flex
                      h-full
                      min-h-[500px]
                      items-center
                      justify-center
                      p-8
                    "
                  >

                    <div className="max-w-sm text-center">

                      <div
                        className="
                          mx-auto
                          mb-5
                          flex
                          h-12
                          w-12
                          items-center
                          justify-center
                          rounded-xl
                          bg-slate-100
                          text-slate-600
                        "
                      >
                        <Users className="h-5 w-5" />
                      </div>

                      <h3 className="text-lg font-semibold text-slate-900">
                        Add your first group member
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Your account is already the group owner.
                        Add up to three other researchers to continue.
                      </p>

                      <button
                        type="button"
                        onClick={addMember}
                        className="
                          mt-6
                          inline-flex
                          items-center
                          gap-2
                          rounded-lg
                          bg-slate-900
                          px-5
                          py-2.5
                          text-sm
                          font-medium
                          text-white
                          transition-colors
                          hover:bg-slate-800
                        "
                      >
                        <Plus className="h-4 w-4" />
                        Add member
                      </button>

                    </div>

                  </div>

                )}

              </div>

            </div>

            {/* ================================================= */}
            {/* ERROR */}
            {/* ================================================= */}

            {error && (

              <div
                className="
                  border-t
                  border-red-100
                  bg-red-50
                  px-6
                  py-3
                  md:px-8
                "
              >

                <p className="text-sm text-red-600">
                  {error}
                </p>

              </div>

            )}

            {/* ================================================= */}
            {/* FOOTER */}
            {/* ================================================= */}

            <div
              className="
                flex
                flex-col-reverse
                gap-3
                border-t
                border-slate-200
                bg-white
                px-6
                py-4
                sm:flex-row
                sm:items-center
                sm:justify-between
                md:px-8
              "
            >

              <div className="text-xs text-slate-400">

                {members.length === 0
                  ? 'Owner + 0 additional members'
                  : `Owner + ${members.length} additional ${
                      members.length === 1
                        ? 'member'
                        : 'members'
                    }`}

              </div>

              <div className="flex items-center justify-end gap-3">

                {activeMember > 0 && members.length > 0 && (

                  <button
                    type="button"
                    onClick={previousMember}
                    disabled={isCreatingGroup}
                    className="
                      inline-flex
                      items-center
                      gap-2
                      rounded-lg
                      border
                      border-slate-200
                      bg-white
                      px-4
                      py-2.5
                      text-sm
                      font-medium
                      text-slate-600
                      transition-colors
                      hover:bg-slate-50
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                    "
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Previous
                  </button>

                )}

                {members.length > 0 &&
                  activeMember < members.length - 1 && (

                    <button
                      type="button"
                      onClick={nextMember}
                      disabled={isCreatingGroup}
                      className="
                        inline-flex
                        items-center
                        gap-2
                        rounded-lg
                        bg-slate-900
                        px-5
                        py-2.5
                        text-sm
                        font-medium
                        text-white
                        transition-colors
                        hover:bg-slate-800
                        disabled:cursor-not-allowed
                        disabled:opacity-50
                      "
                    >
                      Next member
                      <ArrowRight className="h-4 w-4" />
                    </button>

                  )}

                {members.length > 0 &&
                  activeMember === members.length - 1 && (

                    <button
                      type="button"
                      onClick={createGroup}
                      disabled={isCreatingGroup}
                      className="
                        inline-flex
                        items-center
                        gap-2
                        rounded-lg
                        bg-slate-900
                        px-5
                        py-2.5
                        text-sm
                        font-medium
                        text-white
                        transition-colors
                        hover:bg-slate-800
                        disabled:cursor-not-allowed
                        disabled:opacity-60
                      "
                    >

                      {isCreatingGroup ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creating group...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Create research group
                        </>
                      )}

                    </button>

                  )}

              </div>

            </div>

          </div>

        </div>

      )}

    </main>
  );
}