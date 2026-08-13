# SP: RepAjusteEntradaSalidaCaracteristica
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saSubLinea`](../tables/saSubLinea.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: RepAjusteEntradaSalidaCaracteristica
DESCRIPCION: Reporte de Ajuste Entrada Salida con sus Caracteristica
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/ 
CREATE PROCEDURE [dbo].[RepAjusteEntradaSalidaCaracteristica]
	-- Add the parameters for the stored procedure here
    @sNum_Ajuste_d CHAR(20)   = NULL,
    @sNum_Ajuste_h CHAR(20)   = NULL,
    @sCo_Sucursal CHAR(6)     = NULL,    
    @sCampOrderBy VARCHAR(16) = NULL,
    @sDir VARCHAR(6)          = NULL,
    @bHeaderRep BIT = 0
AS 
    BEGIN
    
    SET NOCOUNT ON;
    
       select 
		e.fecha, e.motivo, e.ajue_num, r.reng_num as 'Numero Renglon',  r.cost_unit, r.co_tipo, 
		r.total_art as 'Cantidad Art Renglon', a.modelo, a.art_des, a.co_art, v.co_alma, r.co_uni,
		v.cantidad as 'Cantidad Vista', 
		sub_01.subl_des as subl_des01, 
		sub_02.subl_des as subl_des02,
		sub_03.subl_des as subl_des03,  
		sub_04.subl_des as subl_des04, 
		sub_05.subl_des as subl_des05
	   from saAjuste E 
		inner join saAjusteReng R on e.ajue_num = r.ajue_num 
		inner join saArticulo A on a.co_art = r.co_art
			left join savArtCaracteristicaAJUS V on r.ajue_num = v.num_doc and r.reng_num = v.reng_num
            left join sasublinea as sub_01 on sub_01.co_lin = v.co_lin01 and sub_01.co_subl = v.co_subl01
			left join sasublinea as sub_02 on sub_02.co_lin = v.co_lin02 and sub_02.co_subl = v.co_subl02
			left join sasublinea as sub_03 on sub_03.co_lin = v.co_lin03 and sub_03.co_subl = v.co_subl03
			left join sasublinea as sub_04 on sub_04.co_lin = v.co_lin04 and sub_04.co_subl = v.co_subl04
			left join sasublinea as sub_05 on sub_05.co_lin = v.co_lin05 and sub_05.co_subl = v.co_subl05
      
        WHERE
			(@sNum_Ajuste_d IS NULL OR e.ajue_num >= @sNum_Ajuste_d)
		AND (@sNum_Ajuste_h IS NULL OR e.ajue_num <= @sNum_Ajuste_h)
		AND (@sCo_Sucursal IS NULL OR e.co_sucu_in = @sCo_Sucursal)
		ORDER BY
            e.ajue_num
    END
```
