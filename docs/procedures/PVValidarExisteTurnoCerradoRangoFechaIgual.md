# SP: PVValidarExisteTurnoCerradoRangoFechaIgual
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`pvTurnoExe`](../tables/pvTurnoExe.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <05/06/2014>
-- Description:	<Categoria de los articulos>
-- =============================================
CREATE PROCEDURE [dbo].[PVValidarExisteTurnoCerradoRangoFechaIgual]
    (
             @co_TurnEx          CHAR(20),
             @co_Turno           CHAR(6),
             @co_Usuario         CHAR(6),
             @co_Caja            CHAR(6),
             @fec_ini            SMALLDATETIME,
             @fec_fin            SMALLDATETIME
    )
AS 
    BEGIN
             
             SELECT TOP 1 *
                    FROM PVTurnoExe WHERE 
             (
                    @co_Usuario = user_caj OR @co_Caja = cod_caja
             )
                    AND  @co_TurnEx                       <>              num_turno
                    AND PVTurnoExe.status             =                   'C'  
                    AND (fecha_ini <=  @fec_ini AND fecha_fin >= @fec_fin) 
                           ORDER BY num_turno
    END
```
