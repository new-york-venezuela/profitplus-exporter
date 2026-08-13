# SP: pObtenerRifProveedor2
**Tipo**: Obtener
**Módulo**: Clientes

## Tablas Referenciadas
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerRifProveedor
DESCRIPCION: Verifica si ya existe un rif en la bd igual al que se esta ingresando
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerRifProveedor2] ( @sRif CHAR(18) , @sCo_prov char(16), @sMatriz char(16) )
AS 
    BEGIN	

        DECLARE @bExiste BIT
        
         if @sMatriz is null
                  set @sMatriz = ''

        IF EXISTS ( SELECT
                        p.rif, p.co_prov
                    FROM
                        saProveedor p
                    WHERE
                        rif = @sRif
                                   AND nacional = 1 AND P.co_prov <> @sCo_prov -- Se excluye a el mismo
                                   and (P.matriz <> @sCo_prov or P.matriz is null) -- Se excluye a Hijos
                                   and P.co_prov <> @sMatriz -- Se excluye al Padre
                                   and (P.matriz <> @sMatriz or P.matriz is null)-- Se excluye a Hermanos 
                        
                        ) 
            SET @bExiste = 1
        ELSE 
            SET @bExiste = 0

        SELECT
            @bExiste AS Existe

    END
```
