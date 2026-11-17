using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MiniNote.Domain.Entities;

namespace MiniNote.Infrastructure.Persistence.Configurations;

public sealed class ChecklistItemConfiguration : IEntityTypeConfiguration<ChecklistItem>
{
    public void Configure(EntityTypeBuilder<ChecklistItem> builder)
    {
        builder.HasKey("NoteId", nameof(ChecklistItem.Id));
        builder.Property(item => item.Id).ValueGeneratedNever();
        builder.Property(item => item.Text).HasMaxLength(ChecklistItem.MaxTextLength).IsRequired();
        builder.HasIndex("NoteId", nameof(ChecklistItem.Position));
    }
}
