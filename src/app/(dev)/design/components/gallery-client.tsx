"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Bell,
  Copy,
  Droplets,
  Ellipsis,
  Flame,
  Footprints,
  Inbox,
  Pencil,
  Plus,
  Salad,
  Scale,
  ScanBarcode,
  Search,
  Settings,
  Star,
  Target,
  Trash,
  User,
  Utensils,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { AdaptiveSheet } from "@/components/ui/adaptive-sheet";

import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, getInitials } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { CalorieBudget } from "@/components/ui/calorie-budget";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListGroup, ListItem, ListItemIcon } from "@/components/ui/list";
import { MacroBar } from "@/components/ui/macro-bar";
import { MacroChips, NutritionBadge } from "@/components/ui/macro-chips";
import { MacroRings } from "@/components/ui/macro-rings";
import { NumberInput, numberFieldProps } from "@/components/ui/number-input";
import { PageHeader } from "@/components/ui/page-header";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProgressRing } from "@/components/ui/progress-ring";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { toast, undoToast } from "@/components/ui/sonner";
import { Spinner } from "@/components/ui/spinner";
import { StatTile } from "@/components/ui/stat-tile";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { z } from "@/lib/zod";

function Demo({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className={cn("flex flex-wrap items-center gap-3", className)}>{children}</CardContent>
    </Card>
  );
}

export function ComponentGallery() {
  return (
    <main className="mx-auto flex w-full max-w-wide flex-col gap-10 px-gutter pt-safe-offset-4 pb-safe-offset-24">
      <PageHeader
        eyebrow="Intern · nicht indexiert"
        title="Komponenten-Galerie"
        subtitle="Alle Bausteine aus src/components/ui in ihren Zuständen. Alle Zahlen sind Beispielwerte."
        actions={<ThemeToggle iconOnly />}
      />
      <NutritionSection />
      <ButtonSection />
      <FieldSection />
      <SelectionSection />
      <NavigationSection />
      <OverlaySection />
      <LayoutSection />
      <FeedbackSection />
      <FormSection />
    </main>
  );
}

/* ------------------------------------------------------------------------------------ */

function NutritionSection() {
  const [kcal, setKcal] = useState([1450]);
  const target = 2000;
  return (
    <Section title="Ernährung" description="Ringe, Balken und Chips für Dashboard und Tagebuch (Beispielwerte).">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>CalorieBudget + ProgressRing</CardTitle>
            <CardDescription>Regler bewegen: Feder-Animation, 0 = Ziel-Anzeige, über 2.250 = zweite Runde.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <CalorieBudget consumed={kcal[0]} target={target} activity={250} />
            <Slider value={kcal} onValueChange={setKcal} min={0} max={4000} step={50} thumbLabels={["Gegessene Kalorien"]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>ProgressRing – Zustände</CardTitle>
            <CardDescription>0 %, 72 %, genau 100 %, 125 % und 230 % (Überlauf gedeckelt).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            {[0, 72, 100, 125, 230].map((v, i) => (
              <ProgressRing
                key={v}
                value={v}
                max={100}
                label={`Beispiel ${v} Prozent`}
                unit="%"
                size={72}
                tone={(["water", "protein", "success", "kcal", "fat"] as const)[i]}
              >
                <span className="text-sm font-semibold tabular-nums">{v}%</span>
              </ProgressRing>
            ))}
            <ProgressRing value={1.6} max={2.5} label="Wasser" unit="l" size={72} tone="water" track="soft">
              <Droplets className="size-5 text-water" aria-hidden="true" />
            </ProgressRing>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>MacroBar</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <MacroBar label="Protein" consumed={82} target={140} tone="protein" />
            <MacroBar label="Kohlenhydrate" consumed={140} target={140} tone="carbs" />
            <MacroBar label="Fett" consumed={86} target={70} tone="fat" />
            <MacroBar label="Ballaststoffe" consumed={12} target={30} tone="fiber" size="sm" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>MacroRings · MacroChips · NutritionBadge</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <MacroRings
              protein={{ consumed: 82, target: 140 }}
              carbs={{ consumed: 190, target: 220 }}
              fat={{ consumed: 81, target: 70 }}
            />
            <Separator />
            <MacroChips kcal={230} protein={12.4} carbs={30} fat={5} />
            <MacroChips protein={24} carbs={3} fat={11} variant="soft" />
            <div className="flex flex-wrap gap-2">
              <NutritionBadge nutrient="kcal" value={412} variant="soft" />
              <NutritionBadge nutrient="fiber" value={6.5} decimals={1} variant="soft" />
              <NutritionBadge nutrient="water" value={500} variant="soft" />
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Gewicht" value={72.4} decimals={1} unit="kg" icon={<Scale />} tone="weight" delta={{ value: -0.6, unit: "kg", goodDirection: "down", label: "vs. Vorwoche" }} />
        <StatTile label="Schritte" value={8432} icon={<Footprints />} tone="activity" delta={{ value: 1200, decimals: 0, label: "vs. gestern" }} />
        <StatTile label="Streak" value={12} unit="Tage" icon={<Flame />} tone="kcal" hint="Bestwert 21 Tage" />
        <StatTile label="Ø Protein" value={null} unit="g" icon={<Target />} tone="protein" hint="Noch keine Daten" size="sm" />
      </div>
    </Section>
  );
}

function ButtonSection() {
  const [loading, setLoading] = useState(false);
  return (
    <Section title="Buttons">
      <div className="grid gap-4 md:grid-cols-2">
        <Demo title="Varianten">
          <Button>Primär</Button>
          <Button variant="secondary">Sekundär</Button>
          <Button variant="soft">Soft</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Löschen</Button>
          <Button variant="link">Link</Button>
        </Demo>
        <Demo title="Größen, Icons, Zustände">
          <Button size="sm">Klein</Button>
          <Button>
            <Plus /> Hinzufügen
          </Button>
          <Button size="lg">Groß</Button>
          <Button
            loading={loading}
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1500);
            }}
          >
            Speichern
          </Button>
          <Button disabled>Deaktiviert</Button>
          <Button block variant="secondary">
            Volle Breite
          </Button>
        </Demo>
        <Demo title="IconButton">
          <IconButton label="Suchen" size="sm">
            <Search />
          </IconButton>
          <IconButton label="Barcode scannen" variant="secondary">
            <ScanBarcode />
          </IconButton>
          <IconButton label="Hinzufügen" variant="primary" size="lg">
            <Plus />
          </IconButton>
          <IconButton label="Favorit" variant="outline">
            <Star />
          </IconButton>
          <IconButton label="Löschen" variant="destructive" loading>
            <Trash />
          </IconButton>
        </Demo>
      </div>
    </Section>
  );
}

function FieldSection() {
  const [grams, setGrams] = useState<number | null>(150);
  const [servings, setServings] = useState(1.5);
  return (
    <Section title="Eingabefelder">
      <div className="grid gap-4 md:grid-cols-2">
        <Demo title="Input" className="flex-col items-stretch">
          <div className="grid gap-2">
            <Label htmlFor="g-name">Name</Label>
            <Input id="g-name" placeholder="z. B. Haferflocken" />
          </div>
          <Input aria-label="Lebensmittel suchen" variant="inset" leadingIcon={<Search />} placeholder="Lebensmittel suchen" type="search" />
          <Input aria-label="Suche mit Rahmen" leadingIcon={<Search />} placeholder="Mit Rahmen" type="search" />
          <Input aria-label="Menge" suffix="g" defaultValue="150" inputMode="decimal" />
          <Input aria-label="Ungültig" aria-invalid defaultValue="abc" />
          <Input aria-label="Deaktiviert" disabled defaultValue="Deaktiviert" />
          <Textarea aria-label="Notiz" placeholder="Notiz zum Tag …" />
        </Demo>
        <Demo title="NumberInput & QuantityStepper" className="flex-col items-stretch">
          <div className="grid gap-2">
            <Label htmlFor="g-amount">Menge („1,5“ oder „1.5“)</Label>
            <NumberInput id="g-amount" value={grams} onValueChange={setGrams} unit="g" min={0} max={5000} step={0.5} />
            <p className="text-xs text-muted-foreground tabular-nums">
              Wert: {grams === null ? "leer" : formatNumber(grams, { maxFractionDigits: 2 })}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <QuantityStepper label="Portionen" unit="Portionen" value={servings} onValueChange={setServings} step={0.25} min={0.25} max={20} />
            <QuantityStepper label="Stück" defaultValue={2} max={50} size="lg" />
            <QuantityStepper label="Gesperrt" defaultValue={1} disabled />
          </div>
        </Demo>
      </div>
    </Section>
  );
}

function SelectionSection() {
  return (
    <Section title="Auswahl">
      <div className="grid gap-4 md:grid-cols-2">
        <Demo title="Select" className="flex-col items-stretch">
          <Select defaultValue="breakfast">
            <SelectTrigger aria-label="Mahlzeit">
              <SelectValue placeholder="Mahlzeit wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Mahlzeiten</SelectLabel>
                <SelectItem value="breakfast">Frühstück</SelectItem>
                <SelectItem value="lunch">Mittagessen</SelectItem>
                <SelectItem value="dinner">Abendessen</SelectItem>
                <SelectItem value="snack">Snacks</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger aria-label="Einheit">
              <SelectValue placeholder="Einheit wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="g">Gramm (g)</SelectItem>
              <SelectItem value="ml">Milliliter (ml)</SelectItem>
              <SelectItem value="portion">Portion</SelectItem>
            </SelectContent>
          </Select>
        </Demo>
        <Demo title="Checkbox · Switch · Radio · Slider" className="flex-col items-stretch gap-5">
          <div className="flex items-center gap-3">
            <Checkbox id="g-cb1" defaultChecked />
            <Label htmlFor="g-cb1">Als Favorit speichern</Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox id="g-cb2" checked="indeterminate" />
            <Label htmlFor="g-cb2">Teilweise ausgewählt</Label>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="g-sw">Erinnerungen</Label>
            <Switch id="g-sw" defaultChecked />
          </div>
          <RadioGroup defaultValue="moderate" aria-label="Zieltempo">
            {[
              ["slow", "Gemütlich (≈ 0,25 kg/Woche)"],
              ["moderate", "Moderat (≈ 0,45 kg/Woche)"],
              ["fast", "Ambitioniert (≈ 0,7 kg/Woche)"],
            ].map(([value, label]) => (
              <div key={value} className="flex items-center gap-3">
                <RadioGroupItem value={value} id={`g-r-${value}`} />
                <Label htmlFor={`g-r-${value}`}>{label}</Label>
              </div>
            ))}
          </RadioGroup>
          <Slider defaultValue={[30]} max={100} step={5} thumbLabels={["Proteinanteil"]} />
        </Demo>
      </div>
    </Section>
  );
}

function NavigationSection() {
  const [range, setRange] = useState("30d");
  return (
    <Section title="Navigation">
      <div className="grid gap-4 md:grid-cols-2">
        <Demo title="SegmentedControl" className="flex-col items-stretch">
          <SegmentedControl
            aria-label="Zeitraum"
            value={range}
            onValueChange={setRange}
            block
            options={[
              { value: "7d", label: "7T", ariaLabel: "7 Tage" },
              { value: "30d", label: "30T", ariaLabel: "30 Tage" },
              { value: "3m", label: "3M", ariaLabel: "3 Monate" },
              { value: "6m", label: "6M", ariaLabel: "6 Monate" },
              { value: "1y", label: "1J", ariaLabel: "1 Jahr" },
            ]}
          />
          <SegmentedControl
            aria-label="Makro-Modus"
            size="sm"
            className="self-start"
            defaultValue="grams"
            options={[
              { value: "grams", label: "Gramm" },
              { value: "percent", label: "Prozent" },
              { value: "auto", label: "Auto" },
            ]}
          />
        </Demo>
        <Demo title="Tabs" className="flex-col items-stretch">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Übersicht</TabsTrigger>
              <TabsTrigger value="nutrients">Nährwerte</TabsTrigger>
              <TabsTrigger value="history">Verlauf</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="text-sm text-muted-foreground">
              Unterstrichene Tabs für Seitenbereiche.
            </TabsContent>
            <TabsContent value="nutrients" className="text-sm text-muted-foreground">
              Nährwerte-Inhalt.
            </TabsContent>
            <TabsContent value="history" className="text-sm text-muted-foreground">
              Verlauf-Inhalt.
            </TabsContent>
          </Tabs>
          <Tabs defaultValue="day">
            <TabsList variant="pill">
              <TabsTrigger value="day">Tag</TabsTrigger>
              <TabsTrigger value="week">Woche</TabsTrigger>
            </TabsList>
          </Tabs>
        </Demo>
      </div>
    </Section>
  );
}

function OverlaySection() {
  const [servings, setServings] = useState(1);
  return (
    <Section title="Overlays" description="Dialoge und Sheets werden im App-Theme gerendert (Portal).">
      <Demo title="Dialog · ConfirmDialog · Sheet · BottomSheet · Popover · Menü · Toast">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mahlzeit umbenennen</DialogTitle>
              <DialogDescription>Der neue Name erscheint in deinem Tagebuch.</DialogDescription>
            </DialogHeader>
            <Input aria-label="Name der Mahlzeit" defaultValue="Frühstück" />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Abbrechen</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button>Speichern</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          trigger={<Button variant="outline">Bestätigen (destruktiv)</Button>}
          title="Rezept löschen?"
          description="Das Rezept wird dauerhaft entfernt. Bereits geloggte Einträge bleiben erhalten."
          confirmLabel="Löschen"
          destructive
          onConfirm={() => new Promise((resolve) => setTimeout(resolve, 800))}
        />

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">Sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filter</SheetTitle>
              <SheetDescription>Suchergebnisse eingrenzen.</SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="g-f1">Nur eigene Lebensmittel</Label>
                <Switch id="g-f1" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="g-f2">Mit Barcode</Label>
                <Switch id="g-f2" defaultChecked />
              </div>
            </SheetBody>
            <SheetFooter>
              <Button block>Anwenden</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <BottomSheet>
          <BottomSheetTrigger asChild>
            <Button>
              <Utensils /> BottomSheet
            </Button>
          </BottomSheetTrigger>
          <BottomSheetContent>
            <BottomSheetHeader>
              <BottomSheetTitle>Haferflocken</BottomSheetTitle>
              <BottomSheetDescription>Beispiel · 1 Portion = 40 g</BottomSheetDescription>
            </BottomSheetHeader>
            <BottomSheetBody className="flex flex-col items-center gap-5">
              <QuantityStepper label="Portionen" unit="Portionen" value={servings} onValueChange={setServings} step={0.25} min={0.25} size="lg" />
              <MacroChips kcal={150 * servings} protein={5.4 * servings} carbs={23.6 * servings} fat={2.8 * servings} variant="soft" />
              <NumberInput aria-label="Menge in Gramm" unit="g" value={40 * servings} onValueChange={(v) => v !== null && setServings(v / 40)} />
            </BottomSheetBody>
            <BottomSheetFooter>
              <Button block size="lg">
                Zum Frühstück hinzufügen
              </Button>
            </BottomSheetFooter>
          </BottomSheetContent>
        </BottomSheet>

        <AdaptiveSheet
          trigger={<Button variant="soft">AdaptiveSheet</Button>}
          title="Portion wählen"
          description="Mobil als Bottom Sheet, ab 1024 px als Dialog."
          footer={<Button block>Hinzufügen</Button>}
        >
          <div className="flex justify-center py-2">
            <QuantityStepper label="Portionen" unit="Portionen" defaultValue={1} step={0.5} min={0.5} size="lg" />
          </div>
        </AdaptiveSheet>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost">Popover</Button>
          </PopoverTrigger>
          <PopoverContent className="flex flex-col gap-2">
            <p className="text-sm font-medium">Wie wird das berechnet?</p>
            <p className="text-sm text-muted-foreground">Ziel − Gegessen + Aktivität = Übrig.</p>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="Weitere Aktionen" variant="outline">
              <Ellipsis />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Eintrag</DropdownMenuLabel>
            <DropdownMenuItem>
              <Pencil /> Bearbeiten
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Copy /> Kopieren nach …
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <Trash /> Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton label="Benachrichtigungen" variant="ghost">
              <Bell />
            </IconButton>
          </TooltipTrigger>
          <TooltipContent>Benachrichtigungen</TooltipContent>
        </Tooltip>

        <Button
          variant="secondary"
          onClick={() => toast.success("Gespeichert", { description: "Dein Ziel wurde aktualisiert." })}
        >
          Toast
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            undoToast("Eintrag gelöscht", {
              onUndo: () => toast("Wiederhergestellt"),
            })
          }
        >
          Undo-Toast
        </Button>
      </Demo>
    </Section>
  );
}

function LayoutSection() {
  return (
    <Section title="Layout">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Standard-Card</CardTitle>
            <CardDescription>Weicher Schatten hell, Haarlinie dunkel.</CardDescription>
            <CardAction>
              <Badge variant="primary">Neu</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Inhalt mit 20 px Innenabstand.</CardContent>
          <CardFooter>
            <Button size="sm" variant="secondary">
              Aktion
            </Button>
          </CardFooter>
        </Card>
        <Card interactive asChild>
          <button type="button" onClick={() => toast("Card angetippt")}>
            <CardHeader>
              <CardTitle>Interaktive Card</CardTitle>
              <CardDescription>Ganze Fläche ist tippbar (asChild + interactive).</CardDescription>
            </CardHeader>
          </button>
        </Card>
        <Card variant="muted">
          <CardHeader>
            <CardTitle>Muted-Card</CardTitle>
            <CardDescription>Für sekundäre Blöcke.</CardDescription>
          </CardHeader>
        </Card>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <ListGroup title="Einstellungen" footer="Gruppierte Liste im iOS-Stil mit führenden Icons und Chevron.">
          <ListItem href="#profil" leading={<ListItemIcon><User /></ListItemIcon>} title="Profil" description="Name, Größe, Geburtsdatum" />
          <ListItem href="#ziele" leading={<ListItemIcon tone="kcal"><Target /></ListItemIcon>} title="Ziele" trailing="2.000 kcal" />
          <ListItem leading={<ListItemIcon tone="water"><Bell /></ListItemIcon>} title="Erinnerungen" trailing={<Switch aria-label="Erinnerungen" defaultChecked />} />
          <ListItem onClick={() => undefined} leading={<ListItemIcon tone="muted"><Settings /></ListItemIcon>} title="Konto löschen" destructive chevron={false} />
        </ListGroup>
        <ListGroup title="Suchergebnisse">
          {[
            { name: "Haferflocken", brand: "Beispielmarke · 40 g", kcal: 150, p: 5, c: 24, f: 3 },
            { name: "Skyr natur", brand: "Beispielmarke · 150 g", kcal: 95, p: 16, c: 6, f: 0 },
            { name: "Banane", brand: "1 mittelgroß · 120 g", kcal: 107, p: 1, c: 24, f: 0 },
          ].map((food) => (
            <ListItem
              key={food.name}
              href={`#${food.name}`}
              chevron={false}
              leading={<ListItemIcon tone="fiber"><Salad /></ListItemIcon>}
              title={food.name}
              description={<MacroChips kcal={food.kcal} protein={food.p} carbs={food.c} fat={food.f} />}
              action={
                <IconButton label={`${food.name} hinzufügen`} variant="soft" size="sm">
                  <Plus />
                </IconButton>
              }
            />
          ))}
        </ListGroup>
      </div>
      <Card className="py-0">
        <EmptyState
          icon={<Inbox />}
          title="Noch nichts geloggt"
          description="Füge dein erstes Lebensmittel hinzu – Milo freut sich schon."
          action={
            <Button>
              <Plus /> Lebensmittel hinzufügen
            </Button>
          }
          secondaryAction={<Button variant="ghost">Barcode scannen</Button>}
        />
      </Card>
    </Section>
  );
}

function FeedbackSection() {
  return (
    <Section title="Feedback & Kleinteile">
      <div className="grid gap-4 md:grid-cols-2">
        <Demo title="Badge · Avatar · Spinner">
          <Badge>Neutral</Badge>
          <Badge variant="primary">Primär</Badge>
          <Badge variant="solid">Solid</Badge>
          <Badge variant="success">Ziel erreicht</Badge>
          <Badge variant="warning">Hinweis</Badge>
          <Badge variant="destructive">Fehler</Badge>
          <Badge variant="outline">Outline</Badge>
          <Avatar size="sm">
            <AvatarFallback>{getInitials("Max Mustermann")}</AvatarFallback>
          </Avatar>
          <Avatar size="lg">
            <AvatarFallback>{getInitials("Erika Beispiel")}</AvatarFallback>
          </Avatar>
          <Spinner />
          <Spinner size="lg" />
        </Demo>
        <Demo title="Skeleton · ScrollArea" className="flex-col items-stretch">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <ScrollArea className="h-32 rounded-md border border-border">
            <ul className="p-3 text-sm">
              {Array.from({ length: 12 }, (_, i) => (
                <li key={i} className="py-1.5 text-muted-foreground">
                  Beispielzeile {i + 1}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </Demo>
      </div>
    </Section>
  );
}

const weightSchema = z.object({
  name: z.string().trim().min(1, "Bitte gib einen Namen ein."),
  weight: z
    .number({ error: "Bitte gib dein Gewicht ein." })
    .min(30, "Mindestens 30 kg.")
    .max(300, "Höchstens 300 kg."),
});

type WeightForm = z.infer<typeof weightSchema>;

function FormSection() {
  const form = useForm<WeightForm>({
    resolver: zodResolver(weightSchema),
    defaultValues: { name: "" },
  });
  return (
    <Section title="Formular (react-hook-form + Zod)">
      <Card>
        <CardContent>
          <Form {...form}>
            <form
              noValidate
              className="grid gap-5 md:max-w-md"
              onSubmit={form.handleSubmit((values) =>
                toast.success(`Gespeichert: ${formatNumber(values.weight, { maxFractionDigits: 1 })} kg`),
              )}
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Dein Vorname" autoComplete="given-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gewicht</FormLabel>
                    <FormControl>
                      <NumberInput unit="kg" decimals={1} step={0.1} placeholder="z. B. 72,5" {...numberFieldProps(field)} />
                    </FormControl>
                    <FormDescription>Am besten morgens, vor dem Frühstück.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" loading={form.formState.isSubmitting}>
                Speichern
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </Section>
  );
}
