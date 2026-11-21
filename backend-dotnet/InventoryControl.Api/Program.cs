using InventoryControl.Infrastructure.Data;
using InventoryControl.Api.Controllers;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// 1. Configurar Conexão com o Banco PostgreSQL
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Configure ConnectionStrings__DefaultConnection com a connection string do PostgreSQL. " +
        "Use User Secrets no desenvolvimento local.");
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentOrganization, InventoryControl.Api.CurrentOrganization>();

var authConnectionString = connectionString;
builder.Services.AddDbContext<AuthDbContext>(options =>
    options.UseNpgsql(authConnectionString, npgsql =>
        npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "auth")));

var jwtKey = builder.Configuration["Jwt:Key"];
var jwtIssuer = builder.Configuration["Jwt:Issuer"];
var jwtAudience = builder.Configuration["Jwt:Audience"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32 ||
    string.IsNullOrWhiteSpace(jwtIssuer) || string.IsNullOrWhiteSpace(jwtAudience))
{
    throw new InvalidOperationException(
        "Configure Jwt:Key (mínimo 32 bytes), Jwt:Issuer e Jwt:Audience em User Secrets ou variáveis de ambiente.");
}

builder.Services.AddIdentityCore<ApplicationUser>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequiredLength = 12;
        options.Password.RequireDigit = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireNonAlphanumeric = true;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        options.Lockout.AllowedForNewUsers = true;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<AuthDbContext>()
    .AddSignInManager();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = JwtRegisteredClaimNames.UniqueName,
            RoleClaimType = "role"
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var userManager = context.HttpContext.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
                var userId = context.Principal?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
                var tokenStamp = context.Principal?.FindFirst("sst")?.Value;
                var tokenOrganization = context.Principal?.FindFirst("organization_id")?.Value;
                var user = userId is null ? null : await userManager.FindByIdAsync(userId);
                if (user is null || string.IsNullOrEmpty(tokenStamp) || user.SecurityStamp != tokenStamp ||
                    !int.TryParse(tokenOrganization, out var organizationId) || user.OrganizationId != organizationId)
                    context.Fail("Sessão expirada ou conta removida.");
            }
        };
    });
builder.Services.AddAuthorization();

var allowedOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? string.Empty)
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .Select(origin => origin.TrimEnd('/'))
    .Where(origin => !string.IsNullOrWhiteSpace(origin))
    .ToArray();
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy =>
{
    policy.AllowAnyHeader().AllowAnyMethod();
    if (allowedOrigins.Length > 0)
        policy.WithOrigins(allowedOrigins);
}));

// Registrar Serviços da Aplicação (Injeção de Dependência)
builder.Services.AddScoped<InventoryControl.Application.Services.NfeService>();
builder.Services.AddHttpClient();

// 2. Controladores e JSON Serialization (preserva exatamente o nome das propriedades)
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

// 3. Documentação Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    var authDb = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
    await authDb.Database.ExecuteSqlRawAsync("CREATE SCHEMA IF NOT EXISTS auth;");
    await authDb.Database.MigrateAsync();

    if (!await authDb.Organizations.AnyAsync())
    {
        authDb.Organizations.Add(new Organization { Id = 1, Name = "Minha organização" });
        await authDb.SaveChangesAsync();
    }

    var inventoryDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var schemaPath = Path.Combine(AppContext.BaseDirectory, "database", "schema.sql");
    if (!File.Exists(schemaPath))
        throw new FileNotFoundException("O script de estrutura do banco não foi incluído na publicação.", schemaPath);
    await inventoryDb.Database.ExecuteSqlRawAsync(await File.ReadAllTextAsync(schemaPath));

    await inventoryDb.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS product_identifiers (
            id SERIAL PRIMARY KEY,
            organization_id INTEGER NOT NULL DEFAULT 1,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            market_name VARCHAR(120) NOT NULL,
            code VARCHAR(80) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE categories ADD COLUMN IF NOT EXISTS organization_id INTEGER;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS organization_id INTEGER;
        ALTER TABLE purchases ADD COLUMN IF NOT EXISTS organization_id INTEGER;
        ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS organization_id INTEGER;
        ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS organization_id INTEGER;
        ALTER TABLE product_identifiers ADD COLUMN IF NOT EXISTS organization_id INTEGER;

        UPDATE categories SET organization_id = 1 WHERE organization_id IS NULL;
        UPDATE products SET organization_id = 1 WHERE organization_id IS NULL;
        UPDATE purchases SET organization_id = 1 WHERE organization_id IS NULL;
        UPDATE purchase_items SET organization_id = 1 WHERE organization_id IS NULL;
        UPDATE stock_movements SET organization_id = 1 WHERE organization_id IS NULL;
        UPDATE product_identifiers SET organization_id = 1 WHERE organization_id IS NULL;

        ALTER TABLE categories ALTER COLUMN organization_id SET NOT NULL;
        ALTER TABLE products ALTER COLUMN organization_id SET NOT NULL;
        ALTER TABLE purchases ALTER COLUMN organization_id SET NOT NULL;
        ALTER TABLE purchase_items ALTER COLUMN organization_id SET NOT NULL;
        ALTER TABLE stock_movements ALTER COLUMN organization_id SET NOT NULL;
        ALTER TABLE product_identifiers ALTER COLUMN organization_id SET NOT NULL;

        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_categories_organization') THEN
                ALTER TABLE categories ADD CONSTRAINT fk_categories_organization FOREIGN KEY (organization_id) REFERENCES auth.organizations(id) ON DELETE RESTRICT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_products_organization') THEN
                ALTER TABLE products ADD CONSTRAINT fk_products_organization FOREIGN KEY (organization_id) REFERENCES auth.organizations(id) ON DELETE RESTRICT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_purchases_organization') THEN
                ALTER TABLE purchases ADD CONSTRAINT fk_purchases_organization FOREIGN KEY (organization_id) REFERENCES auth.organizations(id) ON DELETE RESTRICT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_purchase_items_organization') THEN
                ALTER TABLE purchase_items ADD CONSTRAINT fk_purchase_items_organization FOREIGN KEY (organization_id) REFERENCES auth.organizations(id) ON DELETE RESTRICT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_stock_movements_organization') THEN
                ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_organization FOREIGN KEY (organization_id) REFERENCES auth.organizations(id) ON DELETE RESTRICT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_product_identifiers_organization') THEN
                ALTER TABLE product_identifiers ADD CONSTRAINT fk_product_identifiers_organization FOREIGN KEY (organization_id) REFERENCES auth.organizations(id) ON DELETE RESTRICT;
            END IF;
        END $$;

        ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
        ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
        ALTER TABLE product_identifiers DROP CONSTRAINT IF EXISTS ux_product_identifiers_market_code;
        DROP INDEX IF EXISTS ux_product_identifiers_market_code;
        CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_org_name ON categories (organization_id, name);
        CREATE INDEX IF NOT EXISTS ix_products_organization_sku ON products (organization_id, sku) WHERE sku IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS ux_product_identifiers_org_market_code ON product_identifiers (organization_id, market_name, code);
        CREATE INDEX IF NOT EXISTS ix_product_identifiers_product_id
            ON product_identifiers (product_id);
        """);
}

// Configura o Pipeline de execução HTTP
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers().RequireAuthorization();

app.Run();
