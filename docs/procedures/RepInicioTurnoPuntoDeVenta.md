# SP: RepInicioTurnoPuntoDeVenta
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvTurno`](../tables/pvTurno.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saCaja`](../tables/saCaja.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: RepInicioTurnoPuntoDeVenta
DESCRIPCION: Reporte de Inicio de Turnos de Punto de Venta
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/ 
CREATE PROCEDURE [dbo].[RepInicioTurnoPuntoDeVenta] 
-- Add the parameters for the stored procedure here
    @sCo_Turno_d CHAR(6) = NULL ,
    @sCo_Turno_h CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @dFecha_d  smalldatetime = null,	
    @dFecha_h  smalldatetime = null,
    @sCo_Caja_d CHAR(6) = NULL ,
    @sCo_Caja_h CHAR(6) = NULL ,
    @sStatus char(2) = null,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0																

AS 
    BEGIN
    
    SET NOCOUNT ON;
    
    SELECT 
          TE.num_turno, T.co_turno, (case when TE.status = 'C' then 'Cerrado'  when TE.status = 'N' then 'No Usado' when TE.status = 'E' then 'En Espera' when TE.status = 'A' then 'Activo' end) as status,  T.des_turno,   C.cod_caja, 
		  TE.fecha_ini, TE.fecha_fin, TE.user_caj, TE.user_sup, 
         (case when  TE.restringe = '0' then 'Si' else 'No' end) as  Restringe, TE.saldo
	FROM        
			dbo.pvTurno    as T INNER JOIN
            dbo.pvTurnoExe as TE ON T.co_turno = TE.co_turno LEFT JOIN
            dbo.saCaja     as C  ON C.cod_caja = TE.cod_caja
    WHERE
            (@sCo_Turno_d IS NULL OR @sCo_Turno_d >= T.co_turno)
         AND(@sCo_Turno_h IS NULL OR @sCo_Turno_h <= T.co_turno)
         AND(@sCo_Caja_d IS NULL  OR C.cod_caja >=@sCo_Caja_d )
         AND(@sCo_Caja_h IS NULL  OR C.cod_caja <=@sCo_Caja_h)
		 AND(@dFecha_d IS NULL    OR  dbo.FechaSimple(TE.fecha_ini) >= @dFecha_d)
		 AND(@dFecha_h IS NULL    OR  dbo.FechaSimple(TE.fecha_fin) <= @dFecha_h )
		 AND(TE.status = @sStatus OR @sStatus IS NULL)
    ORDER BY
         CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                    WHEN 'des_turno' THEN T.des_turno
                                    ELSE T.co_turno
                               END
         END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                             WHEN 'des_turno' THEN T.des_turno
                                             ELSE T.co_turno
                                        END
```
