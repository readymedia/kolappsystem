# Startprompt for AI-assistenter

Kopier teksten i rammen under inn i en ny samtale med en hvilken som helst AI-assistent (Claude, ChatGPT, Cursor, Copilot osv.). Bytt ut siste linje med det du vil ha gjort.

---

```text
Du skal jobbe videre på «Kølappsystem» – et digitalt kølappsystem for meet-and-greet
med tre stasjoner (A, B, C). Repo: https://github.com/readymedia/kolappsystem

Før du gjør noe:
1. Les AGENTS.md i roten av repoet helt. Den har kart over koden, invarianter som aldri
   skal brytes, vanlige oppgaver og grensene for Vercel Hobby.
2. Les docs/ARKITEKTUR.md (datamodell, API, flyt) og docs/SIKKERHET.md.
3. Ved endring av tekster eller utseende: les docs/UI-SPEC.md.
4. Se CHANGELOG.md for hvilken versjon som er i produksjon og hva som er gjort.

Rammer:
- Drift: Vercel Hobby (gratis) + Neon Postgres Free. Ikke legg til betalte tjenester,
  og ikke øk antall serverkall uten å regne på budsjettet i AGENTS.md §6.
- Stack: Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4,
  Postgres via pakken «postgres». Ingen ORM.
- All UI-tekst på norsk (bokmål). Kode og variabelnavn på engelsk.
- Sikkerhet først: hemmeligheter (nøkler, PIN) forlater aldri serveren, all køendring
  skjer i én låst databasetransaksjon i src/lib/queue.ts.
- Kjør «npm run check» og relevante tester før du sier at noe er ferdig.
- Oppdater dokumentasjon og CHANGELOG.md i samme endring.
- Git-bruker: readymedia / magnus@readymedia.no. Følg SemVer og tag releaser (vX.Y.Z).

Oppgave:
<beskriv hva som skal gjøres>
```

---

## Tips for den som gir oppgaven

- Beskriv **hva** som skal oppnås og **hvorfor**, ikke bare hvordan.
- Si om endringen skal ut i produksjon før et bestemt arrangement.
- Be assistenten vise en kort plan før den skriver kode hvis endringen er stor.
- Be om at den kjører integrasjonstestene mot en **egen testdatabase**, aldri produksjon.
