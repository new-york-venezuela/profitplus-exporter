# SP: pvGetConfigTurno
**Tipo**: Punto de Venta
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvTurno`](../tables/pvTurno.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saCaja`](../tables/saCaja.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pvGetConfigTurno]
       (            
             @sCodUser CHAR(6),
             @sMasterBD CHAR(20)
       )
AS
BEGIN

       DECLARE @sql NVARCHAR(2000)

       SET @sql = N'SELECT Turno.*,
                           Caja.mvisa, Caja.vpostipo, Caja.puerto, Caja.puerto2, Caja.sidisplay, Caja.gavetaser, Caja.descrip AS caja_des, Caja.co_mone,
                           CAJ.descrip AS des_caja, TUR.des_turno, MPU.desc_usuario AS des_cajero, MPU2.desc_usuario AS des_supervisor, Turno.rowguid,
						   (SELECT co_mone from saCaja a where a.cod_caja =Turno.cod_caja2) as co_mone2,
						   (SELECT co_mone from saCaja a where a.cod_caja =Turno.cod_caja3) as co_mone3,
						   (SELECT descrip from saCaja a where a.cod_caja =Turno.cod_caja2)  as des_caja2,
						   (SELECT descrip from saCaja a where a.cod_caja =Turno.cod_caja3)  as des_caja3
       FROM pvTurnoExe Turno 
        INNER JOIN pvVCaja Caja ON Caja.cod_caja = Turno.cod_caja 
        INNER JOIN saCaja CAJ ON CAJ.cod_caja = Turno.cod_caja 
        INNER JOIN pvTurno TUR ON TUR.co_turno = Turno.co_turno 
        INNER JOIN ' + LTRIM(RTRIM(@sMasterBD)) + '.dbo.MpUsuario MPU ON MPU.cod_usuario = Turno.user_caj COLLATE DATABASE_DEFAULT 
        INNER JOIN ' + LTRIM(RTRIM(@sMasterBD)) + '.dbo.MpUsuario MPU2 ON MPU2.cod_usuario = Turno.user_sup COLLATE DATABASE_DEFAULT     
       WHERE 
    Turno.user_caj = @sCodUser 
    AND Turno.status IN (''A'',''I'',''E'')
    AND Turno.fecha_ini < getdate()
    AND NOT EXISTS (SELECT * FROM pvTurnoExe A 
             WHERE  
                                  A.user_caj = @sCodUser
                                  AND A.status IN (''A'',''E'')
                                  AND A.fecha_ini < Turno.fecha_ini
                                  )'
       EXEC sp_executesql @query = @sql, @params = N'@sCodUser CHAR(6)',
            @sCodUser = @sCodUser
            
END
```
