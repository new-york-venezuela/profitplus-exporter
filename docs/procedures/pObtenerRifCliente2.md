# SP: pObtenerRifCliente2
**Tipo**: Obtener
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pObtenerRifCliente2] ( @sRif CHAR(18), @sCo_cli char(16), @sMatriz char(16))
AS 
    BEGIN   

        DECLARE @bExiste BIT

            if @sMatriz is null
                  set @sMatriz = ''

        IF EXISTS ( SELECT
                        C.rif, C.co_cli
                    FROM
                        saCliente C
                    WHERE
                        rif = @sRif 
                                   and C.co_cli <> @sCo_cli -- Se excluye a el mismo
                                   and (C.matriz <> @sCo_cli or c.matriz is null) -- Se excluye a Hijos
                                   and C.co_cli <> @sMatriz -- Se excluye al Padre
                                   and (C.matriz <> @sMatriz or c.matriz is null)-- Se excluye a Hermanos 
                             ) 
            SET @bExiste = 1
        ELSE 
            SET @bExiste = 0
        SELECT
            @bExiste AS Existe
    END
```
