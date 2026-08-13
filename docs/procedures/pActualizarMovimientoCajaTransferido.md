# SP: pActualizarMovimientoCajaTransferido
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pActualizarMovimientoCajaTransferido]
    (	
		@bTransferido bit,	
		@sMov_Num CHAR(20),
		@tsValidador timestamp
    )
AS 
    BEGIN
		
		DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
        
        UPDATE
            saMovimientoCaja
        SET transferido = @bTransferido
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            mov_num = @sMov_Num 
            AND validador = @tsValidador

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
	
        SELECT
            *
        FROM
            @TableTimestamp
    END
```
