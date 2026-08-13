# SP: pValidarTipoXTabulador
**Tipo**: Validar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saTabuladorIslr`](../tables/saTabuladorIslr.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarTipoXTabulador]
    (
      @sTipo CHAR(6) ,
      @sTabulador CHAR(20)
    )
AS 
    BEGIN
		
        DECLARE @bExiste BIT
		
        IF EXISTS ( SELECT
                        *
                    FROM
                        dbo.saTabuladorIslr
                    WHERE
                        co_tab = @sTabulador
                        AND tipo_per = @sTipo ) 
            SET @bExiste = 1
        ELSE 
            SET @bExiste = 0

        SELECT
            @bExiste AS existe

    END
```
