"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DAppKitProvider,
  useCurrentAccount,
  useDAppKit,
  useWallets,
} from "@mysten/dapp-kit-react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Binoculars,
  Check,
  Clock3,
  Download,
  ExternalLink,
  Flag as FlagIcon,
  LoaderCircle,
  MapPin,
  NotebookPen,
  Plus,
  Search,
  Share2,
  Ticket,
  UserRound,
  WifiOff,
  X,
} from "lucide-react";
import type { Transaction } from "@mysten/sui/transactions";
import { dAppKit } from "@/lib/dapp-kit";
import type { AppState, Profile, Quest, QuestKind } from "@/lib/types";
import { EVENT, KIND_LABELS, shortAddress, ticketCode } from "@/lib/types";
import { explorerObject, explorerTransaction } from "@/lib/config";
import { createQuestTransaction, questTransaction } from "@/lib/transactions";
import { Avatar, Flag, Stamp } from "./illustrations";
import { QuestCard, QuestIcon } from "./quest-card";
import {
  ProfileForm,
  QuestForm,
  type ProfileInput,
  type QuestInput,
} from "./forms";
import { Sheet } from "./sheet";
import { InstallContent, usePwa } from "./pwa";

type Tab = "explore" | "ticket" | "journal";
type Modal = "profile" | "create" | "wallet" | "install" | "about" | null;
type Recovery = { digest: string; address: string };
async function api<T>(
  path: string,
  data?: unknown,
  method?: string,
): Promise<T> {
  const response = await fetch(path, {
    method: method ?? (data ? "POST" : "GET"),
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "Could not save that. Please try again.");
  return result;
}
function friendlyError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Something went wrong. Please try again.";
  if (/reject|denied|cancelled|canceled by/i.test(message))
    return "Wallet approval canceled. Nothing changed. You can try again.";
  if (/gas|balance|coin/i.test(message))
    return "Your wallet needs testnet SUI for gas. Get free testnet SUI from the faucet.";
  if (/MoveAbort|abort code|EStale/i.test(message))
    return "This ticket changed or the action is no longer available. Refresh and try again.";
  if (/fetch|network/i.test(message))
    return "Could not reach the server. Check your connection and try again.";
  return message;
}

function App() {
  const account = useCurrentAccount();
  const kit = useDAppKit();
  const wallets = useWallets();
  const [state, setState] = useState<AppState>({
    profiles: [],
    quests: [],
    address: null,
    packageId: "",
  });
  const [tab, setTab] = useState<Tab>("explore");
  const [browse, setBrowse] = useState<"people" | "quests">("people");
  const [modal, setModal] = useState<Modal>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [person, setPerson] = useState<Profile | null>(null);
  const [ownProfile, setOwnProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QuestKind | "all">("all");
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [qr, setQr] = useState("");
  const mutation = useRef(false);
  const requestId = useRef(0);
  const contentRef = useRef<HTMLElement>(null);
  usePwa();

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const next = await api<AppState>("/api/quests");
      if (id === requestId.current) {
        setState(next);
        setLoading(false);
      }
      return next;
    } catch (err) {
      if (id === requestId.current) {
        setError(friendlyError(err));
        setLoading(false);
      }
    }
  }, []);
  useEffect(() => {
    void refresh();
    const poll = setInterval(() => {
      if (!document.hidden && navigator.onLine && !mutation.current)
        void refresh();
    }, 7000);
    const onFocus = () => {
      if (!mutation.current) void refresh();
    };
    const onOnline = () => {
      setOnline(true);
      void refresh();
    };
    const onOffline = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    try {
      const saved = localStorage.getItem("sidequest-pending-transaction");
      if (saved) setRecovery(JSON.parse(saved));
    } catch {}
    const route = () => {
      const url = new URL(location.href);
      setSelectedId(url.searchParams.get("quest"));
      const nextTab = url.searchParams.get("tab");
      if (nextTab === "journal" || nextTab === "ticket") setTab(nextTab);
      else setTab("explore");
    };
    route();
    window.addEventListener("popstate", route);
    return () => {
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("popstate", route);
    };
  }, [refresh]);
  useEffect(() => {
    let live = true;
    api<{ profile: Profile | null }>("/api/profile")
      .then((result) => {
        if (live)
          setOwnProfile(
            result.profile?.address === account?.address
              ? result.profile
              : (state.profiles.find(
                  (profile) => profile.address === account?.address,
                ) ?? null),
          );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [account?.address, state.address]);
  useEffect(() => {
    const personAddress = new URL(location.href).searchParams.get("person");
    if (personAddress && state.profiles.length)
      setPerson(
        state.profiles.find((p) => p.address === personAddress) ?? null,
      );
  }, [state.profiles]);
  const go = (nextTab: Tab, id: string | null = null) => {
    setTab(nextTab);
    setSelectedId(id);
    setError("");
    const url = new URL(location.href);
    url.search = "";
    if (id) url.searchParams.set("quest", id);
    else if (nextTab !== "explore") url.searchParams.set("tab", nextTab);
    history.pushState({}, "", url);
    window.scrollTo({ top: 0, behavior: "instant" });
    contentRef.current?.focus({ preventScroll: true });
  };
  const run = async (task: () => Promise<void>) => {
    if (mutation.current) return;
    mutation.current = true;
    setError("");
    setNotice("");
    try {
      await task();
    } catch (err) {
      setError(friendlyError(err));
      await refresh();
    } finally {
      mutation.current = false;
      setBusy("");
    }
  };
  const ensureAuth = async () => {
    if (!account) {
      setModal("wallet");
      throw new Error(
        "Connect a Sui wallet to continue. Browsing is always open.",
      );
    }
    if (!account.chains.includes("sui:testnet"))
      throw new Error("Switch your wallet to Sui testnet, then reconnect.");
    if (state.address === account.address) return account.address;
    setBusy("Approve sign-in");
    const challenge = await api<{ nonce: string; message: string }>(
      "/api/auth/challenge",
      { address: account.address },
    );
    const signed = await kit.signPersonalMessage({
      message: new TextEncoder().encode(challenge.message),
      network: "testnet",
    });
    await api("/api/auth/verify", {
      nonce: challenge.nonce,
      signature: signed.signature,
    });
    setState((previous) => ({ ...previous, address: account.address }));
    return account.address;
  };
  const transact = async (transaction: Transaction, address: string) => {
    if (!online) throw new Error("Reconnect before taking action.");
    setBusy("Approve in wallet");
    const result = await kit.signAndExecuteTransaction({
      transaction,
      network: "testnet",
    });
    if (result.FailedTransaction)
      throw new Error(
        result.FailedTransaction.status.error?.message ?? "Transaction failed.",
      );
    const pending = { digest: result.Transaction.digest, address };
    localStorage.setItem(
      "sidequest-pending-transaction",
      JSON.stringify(pending),
    );
    setRecovery(pending);
    setBusy("Checking testnet");
    const synced = await api<{ quests: Quest[] }>("/api/sync", {
      digest: pending.digest,
    });
    localStorage.removeItem("sidequest-pending-transaction");
    setRecovery(null);
    await refresh();
    return synced.quests[0];
  };
  const saveProfile = async (data: ProfileInput) =>
    run(async () => {
      await ensureAuth();
      setBusy("Saving profile");
      const result = await api<{ profile: Profile }>("/api/profile", data);
      setOwnProfile(result.profile);
      setModal(null);
      await refresh();
      setNotice("Your field notes are saved.");
    });
  const createQuest = async (data: QuestInput) =>
    run(async () => {
      const address = await ensureAuth();
      if (!ownProfile?.visible) {
        setModal("profile");
        throw new Error("Join the event with a visible profile first.");
      }
      setBusy("Preparing ticket");
      const draft = await api<{ reference: string }>("/api/quests", data);
      const quest = await transact(
        createQuestTransaction(draft.reference, state.packageId),
        address,
      );
      setModal(null);
      go("ticket", quest.id);
      setNotice("Your quest is open on Sui testnet.");
    });
  const act = async (
    action: "claim" | "confirm" | "release" | "cancel",
    quest: Quest,
  ) =>
    run(async () => {
      const address = await ensureAuth();
      if (action === "claim" && !ownProfile?.visible) {
        setModal("profile");
        throw new Error(
          "Add a visible profile so the creator knows who to meet.",
        );
      }
      const updated = await transact(
        questTransaction(action, quest, state.packageId),
        address,
      );
      go(updated.status === "completed" ? "journal" : "ticket", updated.id);
      setNotice(
        action === "claim"
          ? "Ticket claimed. Time to say hello."
          : action === "confirm"
            ? updated.status === "completed"
              ? "Both halves confirmed. A good encounter."
              : "Your half is confirmed. Waiting for the other participant."
            : action === "release"
              ? "Ticket released. Someone else can help."
              : "Quest canceled.",
      );
    });
  const shareProfile = async () => {
    if (!account || !ownProfile?.visible) return;
    const url = `${location.origin}/?person=${account.address}`;
    const QRCode = (await import("qrcode")).default;
    setQr(
      await QRCode.toDataURL(url, {
        margin: 2,
        width: 260,
        color: { dark: "#252820", light: "#f5f0e5" },
      }),
    );
    if (navigator.share)
      await navigator
        .share({ title: "Say hello on Sidequest", url })
        .catch(() => {});
  };
  const selected = state.quests.find((q) => q.id === selectedId);
  const myQuests = account
    ? state.quests.filter(
        (q) => q.creator === account.address || q.helper === account.address,
      )
    : [];
  const journal = myQuests
    .filter((q) => q.status === "completed")
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const active = myQuests
    .filter((q) => q.status === "claimed" || q.status === "open")
    .sort(
      (a, b) => Number(b.status === "claimed") - Number(a.status === "claimed"),
    );
  const available = state.quests.filter((q) => q.status === "open");
  const matchingQuests = available.filter(
    (q) =>
      (filter === "all" || filter === q.kind) &&
      `${q.title} ${q.ask} ${state.profiles.find((p) => p.address === q.creator)?.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const matchingPeople = state.profiles.filter((p) =>
    `${p.name} ${p.building} ${p.askAbout} ${p.needsHelp}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          className="brand"
          onClick={() => go("explore")}
          aria-label="Sidequest home"
        >
          <Flag />
          <span>SIDEQUEST IRL</span>
        </button>
        <button
          className="icon-button profile-button"
          aria-label="Your profile"
          onClick={() => setModal("profile")}
        >
          {account ? (
            <Avatar
              name={ownProfile?.name ?? "You"}
              color={ownProfile?.color}
              size="small"
            />
          ) : (
            <UserRound size={21} />
          )}
        </button>
      </header>
      <main ref={contentRef} tabIndex={-1} className="app-main">
        {!online && (
          <div className="notice offline-notice" role="status">
            <WifiOff size={18} />
            You are offline. Reconnect to act on a quest.
          </div>
        )}
        {error && (
          <div className="notice error-notice" role="alert">
            <span>{error}</span>
            <button
              className="icon-button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {notice && (
          <div className="notice success-notice" role="status">
            <Check size={18} />
            {notice}
          </div>
        )}
        {state.chainError && (
          <div className="notice error-notice" role="status">
            {state.chainError}
            <button className="text-button" onClick={() => void refresh()}>
              Retry
            </button>
          </div>
        )}
        {recovery && (
          <div className="notice recovery-notice">
            <span>
              Your transaction was submitted. Check its state before trying
              again.
            </span>
            <a
              href={explorerTransaction(recovery.digest)}
              target="_blank"
              rel="noreferrer"
            >
              View transaction
            </a>
            <button
              className="button secondary"
              disabled={!!busy || !online}
              onClick={() =>
                run(async () => {
                  const address = await ensureAuth();
                  if (address !== recovery.address)
                    throw new Error(
                      "Connect the wallet that submitted this transaction.",
                    );
                  setBusy("Checking testnet");
                  await api("/api/sync", { digest: recovery.digest });
                  localStorage.removeItem("sidequest-pending-transaction");
                  setRecovery(null);
                  await refresh();
                  setNotice("Transaction state recovered.");
                })
              }
            >
              Check submitted transaction
            </button>
          </div>
        )}
        {selected ? (
          <QuestDetail
            quest={selected}
            profiles={state.profiles}
            address={account?.address ?? null}
            busy={busy}
            unavailable={!online || !!state.chainError || !!recovery}
            onBack={() => go(tab)}
            onAction={act}
          />
        ) : selectedId && !loading ? (
          <EmptyState
            icon="ticket"
            title="Ticket not found."
            text="This ticket is unavailable here, or its creator has hidden their profile."
            action="Back to exploring"
            onAction={() => go("explore")}
          />
        ) : tab === "explore" ? (
          <>
            <div className="event-line">
              <span className="eyebrow">{EVENT.label}</span>
              <span className="network-tag">
                <i />
                Sui testnet
              </span>
            </div>
            <section className="hero">
              <h1>
                GOOD PEOPLE.
                <br />
                SMALL QUESTS<span className="orange">.</span>
              </h1>
              <p>
                Five minutes.
                <br className="small-break" /> One less thing you&apos;re stuck
                on.
              </p>
              <span className="hero-note" aria-hidden="true">
                REAL PEOPLE
                <br />
                BRIGHTER DAYS
                <span />
              </span>
            </section>
            <div className="browse-tabs" role="tablist" aria-label="Explore">
              <button
                role="tab"
                id="people-tab"
                aria-controls="browse-results"
                aria-selected={browse === "people"}
                onClick={() => {
                  setBrowse("people");
                  setQuery("");
                }}
              >
                People
              </button>
              <button
                role="tab"
                id="quests-tab"
                aria-controls="browse-results"
                aria-selected={browse === "quests"}
                onClick={() => {
                  setBrowse("quests");
                  setQuery("");
                }}
              >
                Quests
              </button>
              <button
                className="add-quest"
                aria-label="Create a quest"
                onClick={() =>
                  setModal(
                    account && ownProfile?.visible ? "create" : "profile",
                  )
                }
              >
                <Plus size={21} />
              </button>
            </div>
            <label className="search-field">
              <Search size={18} />
              <input
                aria-label={
                  browse === "people"
                    ? "Find a person or topic"
                    : "Find a quest"
                }
                placeholder={
                  browse === "people"
                    ? "A person, a skill, a conversation..."
                    : "Find your next small adventure..."
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  className="icon-button"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                >
                  <X size={16} />
                </button>
              )}
            </label>
            {browse === "quests" && (
              <div className="filter-row" aria-label="Quest filters">
                {(["all", "pitch", "debug", "learn", "demo"] as const).map(
                  (value) => (
                    <button
                      key={value}
                      className={filter === value ? "selected" : ""}
                      aria-pressed={filter === value}
                      onClick={() => setFilter(value)}
                    >
                      {value === "all" ? "All quests" : KIND_LABELS[value]}
                    </button>
                  ),
                )}
              </div>
            )}
            <div className="section-caption">
              <span>
                {browse === "people"
                  ? "People who joined Sidequest"
                  : "Small asks. Real openings."}
              </span>
              <span>UNOFFICIAL</span>
            </div>
            <section
              id="browse-results"
              role="tabpanel"
              aria-labelledby={`${browse}-tab`}
              className={browse === "people" ? "people-list" : "quest-list"}
            >
              {loading ? (
                <div className="loading-state" role="status">
                  <LoaderCircle className="spin" size={23} />
                  <span>Opening the field journal...</span>
                </div>
              ) : browse === "people" ? (
                matchingPeople.length ? (
                  matchingPeople.map((profile) => (
                    <button
                      key={profile.address}
                      className="person-card"
                      onClick={() => setPerson(profile)}
                    >
                      <Avatar name={profile.name} color={profile.color} />
                      <div className="person-copy">
                        <div className="person-name-line">
                          <h3>{profile.name}</h3>
                          {profile.demo && (
                            <span className="demo-label">Demo</span>
                          )}
                        </div>
                        <p className="building">{profile.building}</p>
                        {profile.availableUntil > Date.now() && (
                          <span className="availability">OPEN TO CHAT</span>
                        )}
                        <p className="person-ask">
                          {profile.needsHelp
                            ? `"${profile.needsHelp}"`
                            : profile.askAbout
                              ? `Ask me about ${profile.askAbout}`
                              : "A new face. A good place to start."}
                        </p>
                        <span className="person-link">
                          Meet {profile.name.split(" ")[0]}
                          <ArrowUpRight size={18} />
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <EmptyState
                    icon="people"
                    title={query ? "No matches yet." : "Be the first hello."}
                    text={
                      query
                        ? "Try a different name or topic."
                        : "Join the event and give someone a reason to approach you."
                    }
                    action={query ? "Clear search" : "Join Sidequest"}
                    onAction={() =>
                      query ? setQuery("") : setModal("profile")
                    }
                  />
                )
              ) : matchingQuests.length ? (
                matchingQuests.map((quest) => (
                  <QuestCard
                    key={quest.id}
                    quest={quest}
                    creator={state.profiles.find(
                      (p) => p.address === quest.creator,
                    )}
                    onClick={() => go("explore", quest.id)}
                  />
                ))
              ) : (
                <EmptyState
                  icon="ticket"
                  title="An opening for you."
                  text={
                    query || filter !== "all"
                      ? "No available quests match. Try another filter."
                      : "Put one small ask out there. Someone here might have just the nudge you need."
                  }
                  action={
                    query || filter !== "all"
                      ? "Reset filters"
                      : "Create a quest"
                  }
                  onAction={() => {
                    if (query || filter !== "all") {
                      setQuery("");
                      setFilter("all");
                    } else setModal(ownProfile?.visible ? "create" : "profile");
                  }}
                />
              )}
            </section>
            {!ownProfile && !loading && (
              <button
                className="button primary join-button"
                onClick={() => setModal("profile")}
              >
                Join Sidequest
                <ArrowRight size={19} />
              </button>
            )}
            {ownProfile && (
              <button
                className="button primary join-button"
                onClick={() => setModal("create")}
              >
                <Plus size={19} />
                Put a quest out there
              </button>
            )}
            <div className="explore-footer">
              <p>
                Everyone here opted in.
                <br />
                Demo participants are marked.
              </p>
              <button className="text-button" onClick={() => setModal("about")}>
                How it works
                <ArrowUpRight size={14} />
              </button>
            </div>
          </>
        ) : tab === "ticket" ? (
          <>
            <span className="eyebrow">YOUR QUESTS</span>
            <h1 className="page-title">
              A REASON
              <br />
              TO SAY HELLO<span className="orange">.</span>
            </h1>
            <p className="page-intro">
              Your small asks and your next encounters.
            </p>
            {active.length ? (
              <div className="quest-list">
                {active.map((quest) => (
                  <QuestCard
                    key={quest.id}
                    quest={quest}
                    creator={state.profiles.find(
                      (p) => p.address === quest.creator,
                    )}
                    onClick={() => go("ticket", quest.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon="ticket"
                title="Your next encounter awaits."
                text="Claim a quest or put a small ask out there. Your matching ticket will live here."
                action="Explore quests"
                onAction={() => {
                  setBrowse("quests");
                  go("explore");
                }}
              />
            )}
          </>
        ) : (
          <>
            <span className="eyebrow">YOUR JOURNAL</span>
            <h1 className="page-title">
              GOOD
              <br />
              ENCOUNTERS<span className="orange">.</span>
            </h1>
            <p className="page-intro">Small asks. People worth remembering.</p>
            {journal.length ? (
              <div className="journal-list">
                {journal.map((quest) => (
                  <button
                    className="journal-preview"
                    key={quest.id}
                    onClick={() => go("journal", quest.id)}
                  >
                    <div>
                      <span className="eyebrow">BOTH CONFIRMED</span>
                      <h3>{quest.title}</h3>
                      <p>
                        {participantName(quest.creator, state.profiles)} +{" "}
                        {participantName(quest.helper, state.profiles)}
                      </p>
                      <span className="fine-print">
                        Real Sui testnet receipt
                        {quest.demo ? " / Demo participants" : ""}
                      </span>
                    </div>
                    <Stamp creatorConfirmed helperConfirmed completed />
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="journal"
                title="Every good hello starts somewhere."
                text="After you meet and both confirm, your ticket becomes a souvenir here."
                action="Find a small quest"
                onAction={() => {
                  setBrowse("quests");
                  go("explore");
                }}
              />
            )}
          </>
        )}
        <div className="app-footnote">
          <FlagIcon size={13} />
          <span>Unofficial Basecamp experiment</span>
          <button
            onClick={() => setModal("install")}
            aria-label="Install Sidequest"
          >
            <Download size={16} />
          </button>
        </div>
      </main>
      <nav className="bottom-nav" aria-label="Main navigation">
        {(
          [
            { key: "explore", label: "Explore", Icon: Binoculars },
            { key: "ticket", label: "My ticket", Icon: Ticket },
            { key: "journal", label: "Journal", Icon: NotebookPen },
          ] as const
        ).map(({ key, label, Icon }) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => go(key)}
          >
            <Icon size={25} strokeWidth={1.6} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {person && (
        <Sheet
          title="A good place to start"
          onClose={() => {
            setPerson(null);
            const url = new URL(location.href);
            if (url.searchParams.has("person")) {
              url.searchParams.delete("person");
              history.replaceState({}, "", url);
            }
          }}
        >
          <div className="sheet-content">
            <div className="profile-intro">
              <Avatar name={person.name} color={person.color} />
              <div>
                <h3>{person.name}</h3>
                <p>{person.building}</p>
                {person.demo && (
                  <span className="demo-label">Demo participant</span>
                )}
              </div>
            </div>
            {person.askAbout && (
              <div className="profile-note">
                <span className="eyebrow">ASK ME ABOUT</span>
                <p>{person.askAbout}</p>
              </div>
            )}
            {person.needsHelp && (
              <div className="profile-note">
                <span className="eyebrow">I COULD USE A HAND WITH</span>
                <p>{person.needsHelp}</p>
              </div>
            )}
            <h4 className="eyebrow profile-quests-title">THEIR QUESTS</h4>
            <div className="quest-list">
              {state.quests
                .filter(
                  (q) => q.creator === person.address && q.status === "open",
                )
                .map((q) => (
                  <QuestCard
                    key={q.id}
                    quest={q}
                    creator={person}
                    onClick={() => {
                      setPerson(null);
                      go("explore", q.id);
                    }}
                  />
                ))}
            </div>
            {!state.quests.some(
              (q) => q.creator === person.address && q.status === "open",
            ) && (
              <p>
                No available quest right now. Their profile gives you a
                conversational opening.
              </p>
            )}
          </div>
        </Sheet>
      )}
      {modal && (
        <Sheet
          title={
            {
              profile: ownProfile ? "Your field notes" : "Join the adventure",
              create: "One small ask",
              wallet: "Connect your wallet",
              install: "Take Sidequest with you",
              about: "Five minutes. One good hello.",
            }[modal]
          }
          onClose={() => {
            if (!busy) {
              setModal(null);
              setQr("");
            }
          }}
        >
          {error && (
            <div
              className="sheet-content sheet-error notice error-notice"
              role="alert"
            >
              {error}
            </div>
          )}
          {modal === "profile" ? (
            !account ? (
              <div className="sheet-content">
                <p className="form-intro">
                  Browse freely. Connect a Sui wallet when you are ready to
                  join.
                </p>
                <p>
                  We use a signed message to prove ownership of your profile.
                  Quest actions use real testnet transactions.
                </p>
                <button
                  className="button primary"
                  onClick={() => {
                    setError("");
                    setModal("wallet");
                  }}
                >
                  Choose a wallet
                  <ArrowRight size={18} />
                </button>
                <a
                  className="resource-link"
                  href="https://faucet.sui.io/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Get free testnet SUI
                  <ExternalLink size={14} />
                </a>
              </div>
            ) : (
              <>
                <ProfileForm
                  key={`${account.address}-${ownProfile ? "saved" : "new"}`}
                  profile={ownProfile}
                  busy={busy}
                  onSubmit={saveProfile}
                />
                <div className="sheet-content profile-tools">
                  <p className="fine-print">
                    Wallet: {shortAddress(account.address)} / Sui testnet
                  </p>
                  {ownProfile?.visible && (
                    <button
                      className="button secondary"
                      onClick={() => run(shareProfile)}
                    >
                      <Share2 size={18} />
                      Show my profile QR
                    </button>
                  )}
                  {qr && (
                    <div className="profile-qr">
                      <img
                        src={qr}
                        width="260"
                        height="260"
                        alt="QR code linking to your public Sidequest profile"
                      />
                      <p>Scan for a reason to say hello.</p>
                    </div>
                  )}
                  <a
                    className="resource-link"
                    href="https://faucet.sui.io/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Get free testnet SUI
                    <ExternalLink size={14} />
                  </a>
                  <button
                    className="text-button"
                    onClick={() =>
                      run(async () => {
                        await api("/api/auth/verify", undefined, "DELETE");
                        await kit.disconnectWallet();
                        setOwnProfile(null);
                        setModal(null);
                        await refresh();
                      })
                    }
                  >
                    Disconnect wallet
                  </button>
                </div>
              </>
            )
          ) : modal === "create" ? (
            <QuestForm busy={busy} onSubmit={createQuest} />
          ) : modal === "wallet" ? (
            <div className="sheet-content wallet-list">
              <p>Choose a Sui wallet. This app only uses testnet.</p>
              {wallets.map((wallet) => (
                <button
                  className="wallet-option"
                  key={wallet.name}
                  disabled={!!busy}
                  onClick={() =>
                    run(async () => {
                      setBusy("Connecting wallet");
                      await kit.connectWallet({ wallet });
                      setModal("profile");
                    })
                  }
                >
                  <img src={wallet.icon} width="32" height="32" alt="" />
                  <span>{wallet.name}</span>
                  <ArrowRight size={18} />
                </button>
              ))}
              {!wallets.length && (
                <p>
                  No wallet detected. Open this app in your Sui wallet&apos;s
                  browser, or install a compatible wallet.
                </p>
              )}
              <p className="fine-print">
                Wallet connection is not identity verification. Never share a
                recovery phrase.
              </p>
            </div>
          ) : modal === "install" ? (
            <InstallContent />
          ) : (
            <div className="sheet-content about-content">
              <ol>
                <li>
                  <strong>Find an opening.</strong>
                  <p>Discover a person with one small, specific ask.</p>
                </li>
                <li>
                  <strong>Claim the ticket.</strong>
                  <p>
                    Reserve it on Sui testnet. Meet at the public spot using
                    your matching code.
                  </p>
                </li>
                <li>
                  <strong>Help. Both confirm.</strong>
                  <p>
                    Each person adds half the stamp. Together, it becomes a
                    souvenir.
                  </p>
                </li>
              </ol>
              <p className="fine-print">
                The receipt records mutual confirmation, not proof of quality or
                real-world identity. This is an unofficial event experiment.
                Demo participants are controlled by the builder.
              </p>
              <button
                className="button primary"
                onClick={() => {
                  setModal(null);
                  setBrowse("quests");
                  go("explore");
                }}
              >
                Find my first quest
                <ArrowRight size={18} />
              </button>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}
function participantName(address: string | null, profiles: Profile[]) {
  return (
    profiles.find((p) => p.address === address)?.name ??
    (address ? shortAddress(address) : "A helper")
  );
}
function EmptyState({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: "people" | "ticket" | "journal";
  title: string;
  text: string;
  action: string;
  onAction: () => void;
}) {
  const Icon = { people: Binoculars, ticket: Ticket, journal: NotebookPen }[
    icon
  ];
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={29} strokeWidth={1.5} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      <button className="text-button" onClick={onAction}>
        {action}
        <ArrowRight size={18} />
      </button>
    </div>
  );
}
function QuestDetail({
  quest,
  profiles,
  address,
  busy,
  unavailable,
  onBack,
  onAction,
}: {
  quest: Quest;
  profiles: Profile[];
  address: string | null;
  busy: string;
  unavailable: boolean;
  onBack: () => void;
  onAction: (
    action: "claim" | "confirm" | "release" | "cancel",
    quest: Quest,
  ) => Promise<void>;
}) {
  const creator = profiles.find((p) => p.address === quest.creator);
  const helper = profiles.find((p) => p.address === quest.helper);
  const isCreator = address === quest.creator;
  const isHelper = !!address && address === quest.helper;
  const participant = isCreator || isHelper;
  const myConfirmed = isCreator
    ? quest.creatorConfirmed
    : quest.helperConfirmed;
  const otherName = isCreator
    ? (helper?.name ?? "your helper")
    : (creator?.name ?? "the creator");
  const completed = quest.status === "completed";
  const disabled = !!busy || unavailable;
  return (
    <article className={`quest-detail ${completed ? "completed-detail" : ""}`}>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={19} />
        {completed ? "YOUR JOURNAL" : "YOUR QUEST"}
      </button>
      {completed ? (
        <>
          <h1 className="page-title">
            A GOOD
            <br />
            ENCOUNTER<span className="orange">.</span>
          </h1>
          <p className="page-intro">One small ask. A real conversation.</p>
        </>
      ) : (
        <>
          <div className="detail-heading">
            <span className={`detail-kind detail-${quest.kind}`}>
              <QuestIcon kind={quest.kind} size={34} />
            </span>
            <h1>{quest.title}</h1>
          </div>
          <p className="detail-ask">{quest.ask}</p>
          <div className="detail-meta">
            <span>
              <Clock3 size={22} />
              <span>
                <b>{quest.minutes} MIN</b>
                <small>A small exchange</small>
              </span>
            </span>
            <span>
              <MapPin size={22} />
              <span>
                <b>PUBLIC MEETING POINT</b>
                <small>{quest.meetingPoint}</small>
              </span>
            </span>
          </div>
        </>
      )}
      {quest.demo && (
        <p className="demo-disclosure">
          Demo participants / Real testnet ticket
        </p>
      )}
      {completed ? (
        <div className="souvenir-ticket">
          <span className="eyebrow">{EVENT.label}</span>
          <h2>{quest.title}</h2>
          <p className="souvenir-names">
            {participantName(quest.creator, profiles)} +{" "}
            {participantName(quest.helper, profiles)}
          </p>
          <div className="souvenir-stamp">
            <Stamp creatorConfirmed helperConfirmed completed />
          </div>
          <p className="souvenir-caption">
            {KIND_LABELS[quest.kind]}, exchanged.
          </p>
          <span className="ticket-serial">{ticketCode(quest)}</span>
        </div>
      ) : (
        <>
          <div className="participants">
            <div>
              <Avatar
                name={creator?.name ?? "Creator"}
                color={creator?.color}
                size="small"
              />
              <span>
                <small>Quest creator</small>
                <strong>{creator?.name ?? shortAddress(quest.creator)}</strong>
              </span>
            </div>
            <div>
              {helper ? (
                <Avatar name={helper.name} color={helper.color} size="small" />
              ) : (
                <span className="helper-outline">
                  <UserRound size={22} />
                </span>
              )}
              <span>
                <small>
                  {quest.helper ? "Their helper" : "A little help from"}
                </small>
                <strong>
                  {quest.helper
                    ? (helper?.name ?? shortAddress(quest.helper))
                    : "Maybe you?"}
                </strong>
              </span>
            </div>
          </div>
          {quest.status === "claimed" && participant && (
            <div className="matching-ticket">
              <span className="eyebrow">YOUR MATCHING CODE</span>
              <strong className="matching-code">{ticketCode(quest)}</strong>
              <p>{otherName} sees this code too.</p>
              <div className="ticket-state">
                {myConfirmed
                  ? `YOUR HALF CONFIRMED - Waiting for ${otherName}`
                  : "CLAIMED - Ready to meet"}
              </div>
            </div>
          )}
          {quest.status === "claimed" &&
            participant &&
            (quest.creatorConfirmed || quest.helperConfirmed) && (
              <div className="confirmation-status">
                <Stamp
                  creatorConfirmed={quest.creatorConfirmed}
                  helperConfirmed={quest.helperConfirmed}
                />
                <div>
                  <h3>
                    {myConfirmed
                      ? "Your half is here."
                      : `${otherName} confirmed.`}
                  </h3>
                  <p>
                    {myConfirmed
                      ? "The souvenir is ready when the other half arrives."
                      : "Once you have met, add your half to complete the ticket."}
                  </p>
                </div>
              </div>
            )}
          {quest.status === "open" && (
            <div className="open-note">
              <span className="eyebrow">ONE PERSON. ONE SMALL ASK.</span>
              <p>
                {isCreator
                  ? "Your quest is out there. A helper can claim it when they are ready."
                  : "Claim the ticket, then meet in person. No pressure to solve everything."}
              </p>
            </div>
          )}
          {quest.status === "claimed" && !participant && (
            <div className="notice">
              Someone already claimed this ticket. Explore another available
              quest.
            </div>
          )}
          {quest.status === "canceled" && (
            <div className="notice">
              This quest was canceled. Its history remains on testnet.
            </div>
          )}
          {quest.status === "open" && !isCreator && (
            <button
              className="button primary detail-action"
              disabled={disabled}
              onClick={() => void onAction("claim", quest)}
            >
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={18} />
                  {busy}
                </>
              ) : (
                <>
                  I can help. Claim this quest
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          )}
          {quest.status === "claimed" && participant && !myConfirmed && (
            <button
              className="button primary detail-action"
              disabled={disabled}
              onClick={() => void onAction("confirm", quest)}
            >
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={18} />
                  {busy}
                </>
              ) : (
                <>
                  We met. Confirm my half
                  <Check size={18} />
                </>
              )}
            </button>
          )}
          {quest.status === "claimed" && isHelper && (
            <button
              className="text-button release-action"
              disabled={disabled}
              onClick={() => {
                if (
                  window.confirm(
                    "Release this unfinished quest? Both confirmation halves will be cleared.",
                  )
                )
                  void onAction("release", quest);
              }}
            >
              Release quest
            </button>
          )}
          {(quest.status === "open" || quest.status === "claimed") &&
            isCreator && (
              <button
                className="text-button release-action"
                disabled={disabled}
                onClick={() => {
                  if (
                    window.confirm(
                      "Cancel this unfinished quest permanently? The helper will see it canceled.",
                    )
                  )
                    void onAction("cancel", quest);
                }}
              >
                Cancel quest
              </button>
            )}
          {participant && quest.status === "claimed" && (
            <div className="opening-line">
              <span className="eyebrow">AN EASY FIRST LINE</span>
              <p>
                &quot;Hey, I&apos;m {participantName(address, profiles)}.
                I&apos;m here for your {KIND_LABELS[quest.kind].toLowerCase()}{" "}
                quest.&quot;
              </p>
              <small>
                The matching code helps you find each other. It is not an
                identity check.
              </small>
            </div>
          )}
        </>
      )}
      <div className="chain-receipt">
        <span className="eyebrow">
          {completed ? "REAL SUI TESTNET RECEIPT" : "LIVE ON SUI TESTNET"}
        </span>
        <a href={explorerObject(quest.id)} target="_blank" rel="noreferrer">
          Inspect quest object
          <ExternalLink size={14} />
        </a>
        {quest.digest && (
          <a
            href={explorerTransaction(quest.digest)}
            target="_blank"
            rel="noreferrer"
          >
            View verified transaction
            <ExternalLink size={14} />
          </a>
        )}
        {completed && (
          <p>Both participants confirmed. This records mutual attestation.</p>
        )}
      </div>
    </article>
  );
}
export default function SidequestApp() {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <App />
    </DAppKitProvider>
  );
}
