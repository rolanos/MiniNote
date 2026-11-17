using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniNote.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EnsureUniqueNoteTitles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                LOCK TABLE "Notes" IN ACCESS EXCLUSIVE MODE;

                DO $migration$
                DECLARE
                    duplicate_note record;
                    original_length integer;
                    number integer;
                    suffix text;
                    proposed_title text;
                BEGIN
                    FOR duplicate_note IN
                        SELECT "Id", "NotebookId", "Title"
                        FROM (
                            SELECT "Id", "NotebookId", "Title", "CreatedAt",
                                row_number() OVER (
                                    PARTITION BY "NotebookId", lower("Title") ORDER BY "CreatedAt", "Id"
                                ) AS occurrence
                            FROM "Notes"
                        ) ranked
                        WHERE occurrence > 1
                        ORDER BY "CreatedAt", "Id"
                    LOOP
                        -- The application bounds titles in UTF-16 code units.
                        SELECT length(duplicate_note."Title") + count(*) INTO original_length
                        FROM regexp_split_to_table(duplicate_note."Title", '') AS glyph(value)
                        WHERE ascii(glyph.value) > 65535;

                        number := 2;
                        LOOP
                            suffix := ' (' || number || ')';
                            proposed_title := rtrim(left(duplicate_note."Title",
                                length(duplicate_note."Title") - greatest(0, original_length + length(suffix) - 200)))
                                || suffix;
                            EXIT WHEN NOT EXISTS (
                                SELECT 1 FROM "Notes"
                                WHERE "NotebookId" = duplicate_note."NotebookId"
                                    AND lower("Title") = lower(proposed_title)
                            );
                            number := number + 1;
                        END LOOP;

                        UPDATE "Notes"
                        SET "Title" = proposed_title, "Version" = "Version" + 1
                        WHERE "Id" = duplicate_note."Id";
                    END LOOP;
                END;
                $migration$;

                CREATE UNIQUE INDEX "UX_Notes_NotebookId_TitleLower"
                    ON "Notes" ("NotebookId", lower("Title"));
                """);

            migrationBuilder.AddColumn<string>(
                name: "LastUpdateFingerprint",
                table: "Notes",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DROP INDEX "UX_Notes_NotebookId_TitleLower";""");

            migrationBuilder.DropColumn(
                name: "LastUpdateFingerprint",
                table: "Notes");
        }
    }
}
